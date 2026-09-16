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
  /**
   * Ce qui est réaffiché après un refus.
   *
   * Le code de l'établissement et l'identifiant sont longs à retaper, et les
   * perdre à chaque erreur pousse à noter ses identifiants sur un papier. Le
   * mot de passe, lui, ne repart jamais vers le navigateur.
   */
  readonly saisie?: { readonly code: string; readonly identifiant: string };
}

export const ETAT_INITIAL: EtatConnexion = { etat: "vierge" };
