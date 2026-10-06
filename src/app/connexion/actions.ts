"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { z } from "zod";
import { tenterConnexion } from "@/lib/authentification";
import { chiffrer, lireCles } from "@/lib/chiffrement";
import { DepotSupabase } from "@/lib/depot-authentification";
import { FournisseurSupabase } from "@/lib/fournisseur-supabase";
import { cookieSession, empreinteJeton, NOM_COOKIE_SESSION } from "@/lib/session";
import { baseConfiguree } from "@/lib/supabase-serveur";
import { jetonDepuisLien, normaliserCode } from "@/lib/v6/contexte-etablissement";
import {
  appliquerPolitique,
  decouvrirEtablissement,
  lireContexteEtablissement,
  oublierContexte,
  poserParcours,
} from "@/lib/v6/connexion-serveur";
import { suiteSure } from "@/lib/v6/redirection";
import type { EtatConnexion, EtatEtablissement } from "./etats";

/**
 * Connexion en deux temps : l'établissement, puis l'identifiant.
 *
 * L'identifiant n'est unique que dans un établissement : le code public reste
 * la clé d'identification, mais il est demandé une fois, affiché par son nom,
 * et mémorisé sur un appareil personnel (voir `contexte-etablissement.ts`).
 *
 * Inchangé et toujours ici : la logique sensible vit dans `tenterConnexion`
 * (ordre des contrôles, non-divulgation, limitation des tentatives) ; la
 * session éventuellement présente est révoquée avant d'en émettre une autre
 * (rotation) ; le cookie est HttpOnly, SameSite=Lax, préfixé `__Host-` en
 * production ; la destination vient de la base, jamais du navigateur — seule
 * une route interne revalidée (`suiteSure`) peut être suivie.
 */

const MESSAGES = {
  identifiants: "Identifiant ou mot de passe incorrect. Vérifie ta saisie, ou utilise « Mot de passe oublié ? ».",
  limite: "Trop de tentatives pour ce compte. Patiente avant de réessayer, ou demande un nouvel accès à ton établissement.",
  service: "Le service de connexion ne répond pas pour le moment. Rien n'a été perdu ; réessaie dans quelques minutes.",
  etablissement: "Choisis d'abord ton établissement.",
} as const;

function avecSuite(chemin: string, suite: string | null): string {
  return suite ? `${chemin}?suite=${encodeURIComponent(suite)}` : chemin;
}

/** Étape 1 — trouver l'établissement par son code public. */
export async function trouverEtablissement(_p: EtatEtablissement, donnees: FormData): Promise<EtatEtablissement> {
  const brut = String(donnees.get("code") ?? "").slice(0, 40);
  const suite = suiteSure(String(donnees.get("suite") ?? ""));
  if (brut.trim() === "") return { etat: "refus", message: "Indique le code de ton établissement.", code: brut };
  // Un lien d’invitation collé ici ouvre directement le bon parcours.
  const jeton = jetonDepuisLien(String(donnees.get("code") ?? "").slice(0, 400));
  if (jeton !== null) redirect(`/invitation/${jeton}`);
  const resultat = await decouvrirEtablissement(brut);
  switch (resultat.etat) {
    case "trouve":
      await poserParcours(resultat.contexte);
      redirect(avecSuite("/connexion", suite));
    case "format":
      return { etat: "refus", message: "Un code établissement compte 4 à 16 lettres ou chiffres, sans espace.", code: brut };
    case "inconnu":
      return { etat: "refus", message: "Ce code ne correspond à aucun établissement ouvert sur Study. Vérifie-le sur ta fiche ou ton lien d'invitation.", code: brut };
    case "trop_essais":
      return { etat: "refus", message: "Trop d'essais depuis ce réseau. Réessaie dans une heure, ou utilise le lien d'invitation reçu.", code: brut };
    default:
      return { etat: "refus", message: MESSAGES.service, code: brut };
  }
}

/** « Changer » d'établissement : le contexte mémorisé est effacé. */
export async function changerEtablissement(donnees: FormData): Promise<void> {
  await oublierContexte();
  redirect(avecSuite("/connexion", suiteSure(String(donnees.get("suite") ?? ""))));
}

const schemaConnexion = z.object({
  identifiant: z.string().trim().min(1).max(40),
  // Le mot de passe est transmis tel quel : ni rognage, ni changement de casse.
  motDePasse: z.string().min(1).max(200),
});

export async function seConnecter(_precedent: EtatConnexion, donnees: FormData): Promise<EtatConnexion> {
  const identifiant = String(donnees.get("identifiant") ?? "").slice(0, 40);
  const saisie = { identifiant };

  // Les champs vides sont signalés champ par champ : une faute de saisie
  // n'apprend rien à personne, et ne consomme pas d'essai.
  const champs: EtatConnexion["champs"] = {
    ...(identifiant.trim() === "" ? { identifiant: "Indique ton identifiant." } : {}),
    ...(String(donnees.get("motDePasse") ?? "") === "" ? { motDePasse: "Indique ton mot de passe." } : {}),
  };
  if (Object.keys(champs).length > 0) return { etat: "refus", type: "saisie", message: "Un champ est à compléter.", champs, saisie };

  const contexte = await lireContexteEtablissement();
  // Repli sans cookie (navigateur qui les refuse, ancien formulaire) : le code
  // peut venir du formulaire, et il est revalidé.
  const code = contexte?.code ?? normaliserCode(String(donnees.get("code") ?? ""));
  if (code === null) return { etat: "refus", type: "etablissement", message: MESSAGES.etablissement, saisie };

  if (!baseConfiguree()) return { etat: "refus", type: "service", message: MESSAGES.service, saisie };

  const analyse = schemaConnexion.safeParse({ identifiant, motDePasse: donnees.get("motDePasse") });
  // Une saisie mal formée ne se distingue pas d'un compte inconnu.
  if (!analyse.success) return { etat: "refus", type: "identifiants", message: MESSAGES.identifiants, saisie };

  const appareil = donnees.get("postePartage") === "oui" ? "partage" : "personnel";
  const magasin = await cookies();

  // Rotation : la session éventuellement présente est révoquée d'abord.
  const ancien = magasin.get(NOM_COOKIE_SESSION)?.value;
  if (ancien !== undefined && ancien !== "") {
    try {
      await new DepotSupabase().revoquerSession(empreinteJeton(ancien), "rotation_connexion");
    } catch {
      // Une session déjà expirée ou inconnue n'empêche pas de se connecter.
    }
  }

  let resultat;
  try {
    resultat = await tenterConnexion(
      { codeEtablissement: code, identifiant: analyse.data.identifiant, secret: analyse.data.motDePasse, appareil },
      { depot: new DepotSupabase(), fournisseur: new FournisseurSupabase(), chiffrer: (clair) => chiffrer(clair, lireCles()) },
    );
  } catch (e) {
    console.error(JSON.stringify({ niveau: "erreur", contexte: "connexion", message: e instanceof Error ? e.message.slice(0, 120) : "inconnu" }));
    return { etat: "refus", type: "service", message: MESSAGES.service, saisie };
  }

  if (!resultat.reussi) {
    if (resultat.motif === "trop_de_tentatives") {
      return { etat: "refus", type: "limite", message: MESSAGES.limite, reprendreDansSecondes: resultat.reprendreDansSecondes, saisie };
    }
    if (resultat.motif === "service_indisponible") return { etat: "refus", type: "service", message: MESSAGES.service, saisie };
    return { etat: "refus", type: "identifiants", message: MESSAGES.identifiants, saisie };
  }

  // Appareil partagé : cookie de session de navigateur, sans durée ; appareil
  // personnel : durée de la session serveur.
  const cookie = cookieSession(resultat.jetonSession, resultat.dureeSecondes, appareil === "personnel");
  magasin.set(cookie.name, cookie.value, {
    httpOnly: cookie.httpOnly,
    secure: cookie.secure,
    sameSite: cookie.sameSite,
    path: cookie.path,
    ...(cookie.maxAge !== undefined ? { maxAge: cookie.maxAge } : {}),
  });
  await appliquerPolitique(contexte, appareil);

  try {
    await new DepotSupabase().effacerEchecs(resultat.profileId);
  } catch {
    // Sans importance : la purge périodique s'en charge.
  }

  // Une activation en attente passe toujours avant la reprise du parcours.
  const suite = suiteSure(String(donnees.get("suite") ?? ""));
  redirect(resultat.activationRequise ? "/activation" : (suite ?? "/app"));
}
