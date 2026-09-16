/**
 * État du formulaire de connexion — hors du fichier d'action.
 *
 * Voir `src/app/(public)/(site)/etablissements/etats.ts` : un fichier
 * `"use server"` ne peut exporter que des fonctions asynchrones.
 */

export interface EtatConnexion {
  readonly etat: "vierge" | "refus";
  readonly message?: string;
  readonly reprendreDansSecondes?: number;
}

export const ETAT_INITIAL: EtatConnexion = { etat: "vierge" };
