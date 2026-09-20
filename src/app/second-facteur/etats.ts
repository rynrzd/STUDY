/**
 * États du parcours de second facteur — hors du fichier `"use server"`.
 *
 * Un fichier `"use server"` ne peut exporter que des fonctions asynchrones :
 * la règle est tenue par `tests/unite/actions-serveur.test.ts`.
 */

export interface EtatSecondFacteur {
  readonly etat: "vierge" | "erreur" | "verifie";
  readonly message?: string;
  /** Combien de sessions ouvertes ailleurs ont été fermées à l'activation. */
  readonly sessionsFermees?: number;
}

export const ETAT_SECOND_FACTEUR_INITIAL: EtatSecondFacteur = { etat: "vierge" };
