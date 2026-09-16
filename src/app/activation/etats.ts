/**
 * État de l'écran d'activation — hors du fichier d'action.
 *
 * Voir `src/app/(public)/(site)/etablissements/etats.ts` : un fichier
 * `"use server"` ne peut exporter que des fonctions asynchrones.
 */

export interface EtatActivation {
  readonly etat: "vierge" | "erreur";
  readonly message?: string;
}

export const ETAT_INITIAL: EtatActivation = { etat: "vierge" };
