import { createHash, randomBytes, timingSafeEqual } from "node:crypto";

/**
 * Protection des mutations — WEB-03 du cahier des charges.
 *
 * Trois défenses indépendantes, parce qu'aucune ne suffit seule :
 *
 *  1. `SameSite=Lax` sur le cookie de session. Utile, mais ce n'est pas toute la
 *     défense : elle ne couvre pas les navigations de haut niveau en GET, ni les
 *     navigateurs anciens, ni un sous-domaine compromis.
 *  2. Un jeton CSRF à double dépôt, vérifié à temps constant.
 *  3. La validation de `Origin` et des en-têtes Fetch Metadata.
 *
 * Et une règle structurante : **aucune mutation en GET**. Une requête qui
 * change l'état passe par POST, PUT, PATCH ou DELETE, sans exception.
 */

const METHODES_SANS_EFFET = new Set(["GET", "HEAD", "OPTIONS"]);

export function estMutation(methode: string): boolean {
  return !METHODES_SANS_EFFET.has(methode.toUpperCase());
}

export function genererJetonCsrf(): string {
  return randomBytes(32).toString("base64url");
}

function empreinte(valeur: string): Buffer {
  return createHash("sha256").update(valeur, "utf8").digest();
}

/** Comparaison à temps constant de deux jetons présentés sous forme de texte. */
export function jetonsCorrespondent(a: string | null, b: string | null): boolean {
  if (!a || !b) return false;
  return timingSafeEqual(empreinte(a), empreinte(b));
}

export type RefusCsrf =
  | "origine_absente"
  | "origine_etrangere"
  | "contexte_suspect"
  | "jeton_absent"
  | "jeton_invalide";

export interface RequeteAVerifier {
  readonly methode: string;
  readonly origine: string | null;
  readonly referer: string | null;
  /** `Sec-Fetch-Site` : same-origin, same-site, cross-site ou none. */
  readonly fetchSite: string | null;
  /** `Sec-Fetch-Mode` : navigate, cors, no-cors… */
  readonly fetchMode: string | null;
  readonly jetonEnvoye: string | null;
  readonly jetonCookie: string | null;
}

export interface VerdictCsrf {
  readonly accepte: boolean;
  readonly motif?: RefusCsrf;
}

const ACCEPTE: VerdictCsrf = { accepte: true };

function refus(motif: RefusCsrf): VerdictCsrf {
  return { accepte: false, motif };
}

/**
 * Vérifie une mutation venant d'un navigateur.
 *
 * `originesAutorisees` est la liste explicite des origines du service. Elle ne
 * contient jamais `*`, et le service ne renvoie jamais `Access-Control-Allow-
 * Origin: *` avec des cookies (ch. 25).
 *
 * Les webhooks n'entrent PAS ici : ils sont authentifiés par leur signature et
 * sont exemptés de la logique CSRF navigateur (ch. 25, WEB-03).
 */
export function verifierMutation(
  requete: RequeteAVerifier,
  originesAutorisees: readonly string[],
): VerdictCsrf {
  if (!estMutation(requete.methode)) return ACCEPTE;

  // 1. Fetch Metadata : un POST déclenché depuis un autre site est refusé avant
  //    même de regarder le jeton.
  if (requete.fetchSite !== null) {
    const site = requete.fetchSite.toLowerCase();
    if (site !== "same-origin" && site !== "none") {
      return refus("contexte_suspect");
    }
    // `none` correspond à une action lancée par l'utilisateur hors page (barre
    // d'adresse). Une mutation ne devrait jamais arriver par ce chemin.
    if (site === "none" && requete.fetchMode === "navigate") {
      return refus("contexte_suspect");
    }
  }

  // 2. Origin, avec Referer en repli pour les navigateurs qui l'omettent.
  const origineBrute = requete.origine ?? origineDepuisReferer(requete.referer);
  if (origineBrute === null) return refus("origine_absente");
  if (!originesAutorisees.includes(origineBrute)) return refus("origine_etrangere");

  // 3. Jeton à double dépôt.
  if (!requete.jetonEnvoye || !requete.jetonCookie) return refus("jeton_absent");
  if (!jetonsCorrespondent(requete.jetonEnvoye, requete.jetonCookie)) {
    return refus("jeton_invalide");
  }

  return ACCEPTE;
}

function origineDepuisReferer(referer: string | null): string | null {
  if (!referer) return null;
  try {
    const url = new URL(referer);
    return url.origin;
  } catch {
    return null;
  }
}

/**
 * Origines acceptées pour une mutation.
 *
 * En principe une seule : l'origine canonique du service (APP_ORIGIN, ch. 40).
 * Le BFF ne sert que son propre navigateur ; il n'a aucune raison d'accepter
 * une mutation venue d'ailleurs. Une valeur générique `*` est ignorée, jamais
 * appliquée — le ch. 25 interdit `*` avec des credentials.
 *
 * COLLAB_ORIGIN n'entre pas ici : le service temps réel s'authentifie par
 * ticket signé, pas par cookie, et ne passe pas par cette vérification.
 *
 * @param origineDeLaRequete origine du déploiement qui reçoit la requête. Elle
 *   n'est acceptée que sur un déploiement d'aperçu — voir ci-dessous.
 *
 * S'y ajoute, en production, le domaine canonique déclaré par l'hébergeur
 * (`VERCEL_PROJECT_PRODUCTION_URL`), qui vient lui aussi de l'environnement.
 */
export function originesAutorisees(
  origineDeLaRequete: string | null = null,
  source: Record<string, string | undefined> = process.env,
): string[] {
  const acceptees: string[] = [];

  const canonique = (source.APP_ORIGIN ?? "").trim();
  if (canonique !== "" && canonique !== "*") {
    try {
      acceptees.push(new URL(canonique).origin);
    } catch {
      // APP_ORIGIN illisible : on ne l'accepte pas plutôt que de deviner.
    }
  }

  // Déploiement d'aperçu : son adresse est tirée au hasard à chaque commit et
  // ne peut donc pas figurer dans APP_ORIGIN. Sans cette exception, aucun
  // formulaire n'est utilisable sur une Preview — et la recette avant fusion,
  // qui est tout l'intérêt d'une Preview, devient impossible.
  //
  // L'exception est étroite : elle n'accepte que l'origine du déploiement
  // lui-même, jamais une origine tierce, et elle disparaît en production. Une
  // Preview est de toute façon une origine distincte : ses cookies ne sont pas
  // ceux du domaine de production.
  if (source.VERCEL_ENV === "preview" && origineDeLaRequete !== null) {
    try {
      const propre = new URL(origineDeLaRequete).origin;
      if (!acceptees.includes(propre)) acceptees.push(propre);
    } catch {
      // Origine illisible : rien à ajouter.
    }
  }

  // Le domaine canonique du déploiement, tel que l'hébergeur le déclare.
  //
  // Il vient de l'environnement, comme APP_ORIGIN, et **jamais de la requête** :
  // une page tierce ne peut donc pas le fabriquer. La sécurité est la même ;
  // ce qui change, c'est qu'une seule variable mal renseignée ne suffit plus à
  // rendre tous les formulaires du site inutilisables — panne silencieuse,
  // constatée en production, et invisible à la compilation comme aux tests
  // locaux.
  //
  // APP_ORIGIN reste la valeur qui fait foi partout ailleurs (liens absolus,
  // plan du site, métadonnées) : celle-ci ne la remplace pas, elle la double.
  const canoniqueHebergeur = (source.VERCEL_PROJECT_PRODUCTION_URL ?? "").trim();
  if (canoniqueHebergeur !== "") {
    try {
      const avecProtocole = canoniqueHebergeur.includes("://")
        ? canoniqueHebergeur
        : `https://${canoniqueHebergeur}`;
      const origine = new URL(avecProtocole).origin;
      if (!acceptees.includes(origine)) acceptees.push(origine);
    } catch {
      // Valeur illisible : on ne devine pas.
    }
  }

  return acceptees;
}
