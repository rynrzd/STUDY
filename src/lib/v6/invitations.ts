import { createHash, randomBytes } from "node:crypto";

/**
 * Jetons d'invitation (dossier V6, §6.2) : 32 octets aléatoires, encodés
 * pour une URL. Seule l'empreinte SHA-256 est stockée ; le jeton en clair
 * n'existe que dans le lien remis à la personne invitée.
 */
export function genererJetonInvitation(): string {
  return randomBytes(32).toString("base64url");
}

/** Empreinte au format bytea attendu par PostgREST. */
export function empreinteInvitation(jeton: string): string {
  return `\\x${createHash("sha256").update(jeton).digest("hex")}`;
}

export const FORME_JETON = /^[A-Za-z0-9_-]{40,60}$/u;

/** Code de classe : 10 caractères sans ambiguïté (ni 0/O, ni 1/I/L). */
const ALPHABET_CODE = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function genererCodeClasse(): string {
  const octets = randomBytes(10);
  return Array.from(octets, (o) => ALPHABET_CODE[o % ALPHABET_CODE.length]).join("");
}

export function empreinteCode(code: string): string {
  return `\\x${createHash("sha256").update(code.toUpperCase().replace(/[^A-Z0-9]/gu, "")).digest("hex")}`;
}
