/**
 * Politique de mot de passe.
 *
 * Choix assumé : **longueur d'abord**, pas de composition imposée. Exiger une
 * majuscule, un chiffre et un caractère spécial produit surtout des mots de
 * passe du genre « Motdepasse1! » — courts, devinables et notés sur un
 * post-it. Une phrase de douze caractères ou plus résiste mieux et se retient.
 *
 * Trois refus seulement, et chacun est explicable à un élève de seconde :
 * trop court, trop répétitif, ou trop proche de ce qu'on lui a remis.
 */

export const LONGUEUR_MINIMALE = 12;
export const LONGUEUR_MAXIMALE = 200;

export type RefusMotDePasse =
  | "trop_court"
  | "trop_long"
  | "trop_repetitif"
  | "trop_commun"
  | "identique_au_temporaire"
  | "confirmation_differente";

/** Suites qu'on retrouve dans tous les classements de mots de passe fuités. */
const SUITES_CONNUES = [
  "azerty",
  "qwerty",
  "motdepasse",
  "password",
  "123456",
  "abcdef",
  "aaaaaa",
  "lycee",
  "avecstudy",
];

export interface ControleMotDePasse {
  readonly accepte: boolean;
  readonly motif?: RefusMotDePasse;
}

export function controlerMotDePasse(options: {
  nouveau: string;
  confirmation: string;
  ancien?: string;
}): ControleMotDePasse {
  const { nouveau, confirmation, ancien } = options;

  if (nouveau.length < LONGUEUR_MINIMALE) return { accepte: false, motif: "trop_court" };
  if (nouveau.length > LONGUEUR_MAXIMALE) return { accepte: false, motif: "trop_long" };
  if (nouveau !== confirmation) return { accepte: false, motif: "confirmation_differente" };
  if (ancien !== undefined && nouveau === ancien) {
    return { accepte: false, motif: "identique_au_temporaire" };
  }

  // Moins de cinq caractères distincts : « aaaaaaaaaaaa » fait douze
  // caractères mais ne vaut rien.
  if (new Set(nouveau).size < 5) return { accepte: false, motif: "trop_repetitif" };

  const enMinuscules = nouveau.toLowerCase();
  if (SUITES_CONNUES.some((suite) => enMinuscules.includes(suite))) {
    return { accepte: false, motif: "trop_commun" };
  }

  return { accepte: true };
}

export const MESSAGES_MOT_DE_PASSE: Record<RefusMotDePasse, string> = {
  trop_court: `Choisissez au moins ${LONGUEUR_MINIMALE} caractères. Une phrase courte fait très bien l'affaire.`,
  trop_long: "Ce mot de passe est trop long.",
  trop_repetitif: "Ce mot de passe répète trop peu de caractères différents.",
  trop_commun: "Ce mot de passe contient une suite trop connue. Choisissez autre chose.",
  identique_au_temporaire:
    "Choisissez un mot de passe différent de celui qui vous a été remis.",
  confirmation_differente: "Les deux saisies ne correspondent pas.",
};
