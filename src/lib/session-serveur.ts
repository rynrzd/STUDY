import "server-only";

import { cookies } from "next/headers";
import { DepotSupabase, type LigneSession } from "./depot-authentification.ts";
import { chiffrer, dechiffrer, lireCles } from "./chiffrement.ts";
import type { JetonsFournisseur } from "./identite.ts";
import {
  dureesPour,
  empreinteJeton,
  NOM_COOKIE_SESSION,
  prolongerSurActivite,
  sessionUtilisable,
} from "./session.ts";

/**
 * Lecture de la session côté serveur.
 *
 * Le cookie ne porte qu'un pointeur : tout ce qui décide d'un droit est relu
 * en base à chaque requête. C'est ce qui rend une révocation immédiate — une
 * suspension prise pendant la récréation s'applique au cours suivant, sans
 * attendre l'expiration d'un jeton.
 *
 * Aucune fonction de ce module ne fait confiance à une valeur venant du
 * navigateur autre que le jeton lui-même.
 */

export interface Personne {
  readonly profileId: string;
  readonly organizationId: string | null;
  readonly prenom: string;
  readonly nom: string;
  readonly organisation: string | null;
  readonly roles: readonly string[];
  readonly portee: "etablissement" | "editeur" | "activation";
  readonly niveauAssurance: "aal1" | "aal2";
  readonly activationRequise: boolean;
  readonly appareil: "personnel" | "partage";
  /** Empreinte du jeton : sert à révoquer ou prolonger cette session-ci. */
  readonly empreinte: Buffer;
}

const depot = new DepotSupabase();

/**
 * Session courante, ou `null`.
 *
 * `null` couvre indistinctement : pas de cookie, cookie inconnu, session
 * révoquée, session expirée. L'appelant n'a pas à connaître la différence, et
 * l'interface ne doit pas l'afficher.
 */
export async function sessionCourante(): Promise<Personne | null> {
  const magasin = await cookies();
  const jeton = magasin.get(NOM_COOKIE_SESSION)?.value;
  if (jeton === undefined || jeton === "") return null;

  const empreinte = empreinteJeton(jeton);

  let ligne: LigneSession | null;
  try {
    ligne = await depot.lireSession(empreinte);
  } catch {
    return null;
  }
  if (ligne === null) return null;

  const utilisable = sessionUtilisable(
    {
      revokedAt: ligne.revoked_at === null ? null : new Date(ligne.revoked_at),
      idleExpiresAt: new Date(ligne.idle_expires_at),
      absoluteExpiresAt: new Date(ligne.absolute_expires_at),
    },
  );
  if (!utilisable) return null;

  return {
    profileId: ligne.profile_id,
    organizationId: ligne.organization_id,
    prenom: ligne.prenom,
    nom: ligne.nom,
    organisation: ligne.organisation,
    roles: ligne.roles ?? [],
    portee: ligne.scope,
    niveauAssurance: ligne.niveau_assurance,
    // Une session d'activation est, par construction, une session dont le mot
    // de passe doit encore être choisi.
    activationRequise: ligne.scope === "activation" || ligne.must_change_password === true,
    appareil: ligne.device_kind,
    empreinte,
  };
}

/**
 * Prolonge la session sur activité réelle.
 *
 * À n'appeler que depuis une action de l'utilisateur, jamais depuis un
 * rafraîchissement de fond : le ch. 23 est explicite, un ping ne doit pas
 * maintenir une session ouverte indéfiniment sur un poste de salle info.
 */
export async function marquerActivite(personne: Personne): Promise<void> {
  const durees = dureesPour({
    portee: personne.portee,
    appareil: personne.appareil,
    administratif: estAdministrateur(personne),
  });

  const prolongee = prolongerSurActivite(
    {
      idleExpiresAt: new Date(),
      absoluteExpiresAt: new Date(Date.now() + durees.absolueHeures * 3_600_000),
    },
    durees,
  );

  await depot.prolongerSession(personne.empreinte, prolongee.idleExpiresAt);
}

/**
 * Jeton d'accès du fournisseur, déchiffré, pour agir au nom de la personne.
 *
 * Le jeton expire au bout d'une heure. Sans renouvellement, un professeur qui
 * prépare une séance perdrait la main au milieu de son travail, avec une page
 * qui ne charge plus et aucune explication. On le renouvelle donc dès qu'il
 * approche de son échéance, et on réenregistre le nouveau couple chiffré.
 *
 * La marge de deux minutes évite le cas limite : un jeton valide à la lecture
 * mais périmé à l'arrivée de la requête.
 */
const MARGE_RENOUVELLEMENT_MS = 2 * 60 * 1000;

export async function jetonAccesDe(personne: Personne): Promise<string | null> {
  const ligne = await depot.lireSession(personne.empreinte);
  if (ligne === null || ligne.provider_tokens_chiffres === null) return null;

  let jetons: { access?: string; refresh?: string; expire?: string };
  try {
    const scelle = decoderBytea(ligne.provider_tokens_chiffres);
    jetons = JSON.parse(dechiffrer(scelle, lireCles()));
  } catch {
    return null;
  }

  if (typeof jetons.access !== "string") return null;

  const echeance = typeof jetons.expire === "string" ? Date.parse(jetons.expire) : Number.NaN;
  const encoreBon =
    !Number.isFinite(echeance) || echeance - Date.now() > MARGE_RENOUVELLEMENT_MS;

  if (encoreBon || typeof jetons.refresh !== "string") return jetons.access;

  try {
    const { FournisseurSupabase } = await import("./fournisseur-supabase.ts");
    const neufs = await new FournisseurSupabase().renouveler(jetons.refresh);

    await depot.remplacerJetons(
      personne.empreinte,
      chiffrer(
        JSON.stringify({
          access: neufs.accessToken,
          refresh: neufs.refreshToken,
          expire: neufs.expireLe.toISOString(),
        }),
        lireCles(),
      ),
    );

    return neufs.accessToken;
  } catch {
    // Le renouvellement a échoué : on rend le jeton courant. S'il est périmé,
    // la requête suivante échouera proprement et la personne se reconnectera.
    return jetons.access;
  }
}

/**
 * Le couple de jetons du fournisseur, pour cette session.
 *
 * `jetonAccesDe` ne rend que le jeton d'accès, ce qui suffit à lire des
 * données sous RLS. Le second facteur, lui, a besoin des deux : le client du
 * fournisseur exige une session complète pour accepter `auth.mfa.*`.
 *
 * Aucun renouvellement n'est tenté ici : on rend ce que la session porte. Un
 * enrôlement dure quelques dizaines de secondes, et renouveler au milieu
 * changerait les jetons sous les pieds de l'appelant.
 */
export async function jetonsDe(personne: Personne): Promise<JetonsFournisseur | null> {
  const ligne = await depot.lireSession(personne.empreinte);
  if (ligne === null || ligne.provider_tokens_chiffres === null) return null;

  try {
    const scelle = decoderBytea(ligne.provider_tokens_chiffres);
    const jetons = JSON.parse(dechiffrer(scelle, lireCles())) as {
      access?: string;
      refresh?: string;
      expire?: string;
    };

    if (typeof jetons.access !== "string" || typeof jetons.refresh !== "string") return null;

    return {
      accessToken: jetons.access,
      refreshToken: jetons.refresh,
      expireLe: new Date(jetons.expire ?? Date.now() + 3_600_000),
      niveauAssurance: personne.niveauAssurance,
    };
  } catch {
    return null;
  }
}

/**
 * Range de nouveaux jetons dans cette session.
 *
 * Employé après la vérification d'un second facteur : le fournisseur rend
 * alors des jetons portant `aal2`, et les garder serait sans effet s'ils ne
 * remplaçaient pas ceux de la session.
 */
export async function remplacerJetonsDe(
  personne: Personne,
  jetons: JetonsFournisseur,
): Promise<boolean> {
  try {
    await depot.remplacerJetons(
      personne.empreinte,
      chiffrer(
        JSON.stringify({
          access: jetons.accessToken,
          refresh: jetons.refreshToken,
          expire: jetons.expireLe.toISOString(),
        }),
        lireCles(),
      ),
    );
    return true;
  } catch {
    return false;
  }
}

export function estAdministrateur(personne: Personne): boolean {
  return personne.roles.includes("admin_etablissement") || personne.roles.includes("editeur");
}

export function estExploitant(personne: Personne): boolean {
  return personne.roles.includes("editeur");
}

export function estEnseignant(personne: Personne): boolean {
  return personne.roles.includes("professeur");
}

export function estEleve(personne: Personne): boolean {
  return personne.roles.includes("eleve");
}

/**
 * Où envoyer quelqu'un après une connexion réussie — cahier V2, §5 et §21.
 *
 * L'ordre compte : une personne qui cumule les rôles arrive dans l'espace le
 * plus large dont elle dispose, et navigue vers les autres depuis là.
 */
export function destinationApresConnexion(personne: Personne): string {
  if (personne.activationRequise) return "/activation";
  if (estExploitant(personne)) return "/administration";
  if (estAdministrateur(personne)) return "/admin";
  if (estEnseignant(personne)) return "/professeur";
  return "/eleve";
}

export { depot as depotAuthentification };

/**
 * PostgREST rend un `bytea` sous la forme `\x<hexadécimal>`. On récupère la
 * chaîne d'origine, qui est elle-même le format scellé de `chiffrement.ts`.
 */
function decoderBytea(valeur: string): string {
  if (valeur.startsWith("\\x")) {
    return Buffer.from(valeur.slice(2), "hex").toString("utf8");
  }
  return valeur;
}
