/**
 * États rendus par les actions de l'espace devoirs du professeur.
 *
 * Ils vivent à part du fichier `"use server"`, qui ne peut exporter que des
 * fonctions asynchrones — un test d'unité le vérifie pour tout le dépôt.
 */

export type EtatDevoirAction =
  | { readonly etat: "vierge" }
  | { readonly etat: "ok"; readonly message: string }
  | { readonly etat: "erreur"; readonly message: string };

export const ETAT_DEVOIR_INITIAL: EtatDevoirAction = { etat: "vierge" };
