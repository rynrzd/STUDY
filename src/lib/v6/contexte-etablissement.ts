/**
 * Contexte établissement de la connexion — règles pures, testables.
 *
 * Pourquoi un contexte : l'identifiant (`camille.martin`) n'est unique que
 * dans un établissement (index `memberships_login_per_org`). Le code public
 * de l'établissement départage. On ne le supprime pas ; on évite de le faire
 * retaper.
 *
 * Ce qui est mémorisé : le code public et le nom affiché. Rien de secret,
 * aucun identifiant de personne. Politique :
 * - pendant le parcours de connexion : cookie de session de navigateur
 *   (`COOKIE_PARCOURS`), effacé à la fin de la connexion ;
 * - après une connexion sur un **appareil personnel** : cookie durable
 *   (`COOKIE_MEMOIRE`, un an), effacé par « Changer » ;
 * - après une connexion sur un **appareil partagé** : rien n'est conservé,
 *   et un contexte mémorisé auparavant est effacé.
 */

export const COOKIE_PARCOURS = "study_etab_parcours";
export const COOKIE_MEMOIRE = "study_etablissement";
export const DUREE_MEMOIRE_SECONDES = 365 * 24 * 3600;

export interface ContexteEtablissement {
  readonly code: string;
  readonly nom: string;
}

const FORME_CODE = /^[A-Z0-9-]{4,16}$/u;

export function normaliserCode(brut: string | null | undefined): string | null {
  if (typeof brut !== "string") return null;
  const code = brut.trim().toUpperCase();
  return FORME_CODE.test(code) ? code : null;
}

export function encoderContexte(c: ContexteEtablissement): string {
  return Buffer.from(JSON.stringify({ c: c.code, n: c.nom.slice(0, 160) }), "utf8").toString("base64url");
}

/** Toute valeur mal formée est ignorée : on redemande l'établissement. */
export function decoderContexte(brut: string | null | undefined): ContexteEtablissement | null {
  if (typeof brut !== "string" || brut.length === 0 || brut.length > 600) return null;
  try {
    const v = JSON.parse(Buffer.from(brut, "base64url").toString("utf8")) as { c?: unknown; n?: unknown };
    const code = normaliserCode(typeof v.c === "string" ? v.c : null);
    const nom = typeof v.n === "string" ? v.n.trim() : "";
    if (code === null || nom.length === 0 || nom.length > 160) return null;
    return { code, nom };
  } catch {
    return null;
  }
}

/** Que faire du contexte après une connexion réussie. */
export function politiqueApresConnexion(appareil: "personnel" | "partage"): { memoriser: boolean; effacerParcours: true } {
  return { memoriser: appareil === "personnel", effacerParcours: true };
}

/**
 * Référence d'accusé de réception d'une demande de récupération : huit
 * caractères sans ambiguïté de lecture (ni O/0, ni I/1). Elle n'ouvre rien.
 */
export function referenceDemande(aleatoire: Uint8Array): string {
  const alphabet = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let s = "";
  for (let i = 0; i < 8; i += 1) s += alphabet[(aleatoire[i] ?? 0) % alphabet.length];
  return `${s.slice(0, 4)}-${s.slice(4)}`;
}

/**
 * Un lien d'invitation collé à la place du code : on en extrait le jeton,
 * pour ouvrir directement le bon parcours. Seule la forme est vérifiée ici ;
 * la validité se lit en base.
 */
export function jetonDepuisLien(brut: string | null | undefined): string | null {
  if (typeof brut !== "string") return null;
  const texte = brut.trim();
  const dansLien = /\/invitation\/([A-Za-z0-9_-]{40,60})(?:[/?#]|$)/u.exec(texte);
  if (dansLien?.[1]) return dansLien[1];
  return /^[A-Za-z0-9_-]{40,60}$/u.test(texte) ? texte : null;
}
