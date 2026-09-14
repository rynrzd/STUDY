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
 * Une seule : l'origine canonique du service (APP_ORIGIN, ch. 40). Le BFF ne
 * sert que son propre navigateur ; il n'a aucune raison d'accepter une mutation
 * venue d'ailleurs. Une valeur générique `*` est ignorée, jamais appliquée —
 * le ch. 25 interdit `*` avec des credentials.
 *
 * COLLAB_ORIGIN n'entre pas ici : le service temps réel s'authentifie par
 * ticket signé, pas par cookie, et ne passe pas par cette vérification.
 */
export function originesAutorisees(): string[] {
  const canonique = (process.env.APP_ORIGIN ?? "").trim();
  if (canonique === "" || canonique === "*") return [];
  try {
    return [new URL(canonique).origin];
  } catch {
    return [];
  }
}
