/**
 * État des actions d'entraide — hors du fichier d'action.
 *
 * Un fichier `"use server"` ne peut exporter que des fonctions asynchrones.
 */

export interface EtatEntraide {
  readonly etat: "vierge" | "ok" | "erreur";
  readonly message?: string;
}

export const ETAT_ENTRAIDE_INITIAL: EtatEntraide = { etat: "vierge" };
