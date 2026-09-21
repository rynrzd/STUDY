/**
 * États rendus par les actions de modération.
 *
 * Ils vivent à part du fichier `"use server"`, qui ne peut exporter que des
 * fonctions asynchrones — un test d'unité le vérifie pour tout le dépôt.
 */

export type EtatModeration =
  | { readonly etat: "vierge" }
  | { readonly etat: "ok"; readonly message: string }
  | { readonly etat: "erreur"; readonly message: string };

export const ETAT_MODERATION_INITIAL: EtatModeration = { etat: "vierge" };
