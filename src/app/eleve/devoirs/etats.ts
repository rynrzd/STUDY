/**
 * États rendus par les actions de remise.
 *
 * Ils vivent à part du fichier `"use server"`, qui ne peut exporter que des
 * fonctions asynchrones. Un test d'unité le vérifie pour tout le dépôt.
 */

export type EtatRemiseAction =
  | { readonly etat: "vierge" }
  | {
      readonly etat: "remis";
      readonly reference: string;
      readonly remisLe: string;
      readonly enRetard: boolean;
      readonly numero: number;
    }
  | { readonly etat: "erreur"; readonly message: string };

export const ETAT_REMISE_INITIAL: EtatRemiseAction = { etat: "vierge" };
