import type { AccesCree } from "@/lib/administration";

/**
 * États des actions d'exploitation — hors du fichier d'action.
 *
 * Voir `src/app/(public)/(site)/etablissements/etats.ts` : un fichier
 * `"use server"` ne peut exporter que des fonctions asynchrones.
 */

export interface EtatAction {
  readonly etat: "vierge" | "ok" | "erreur";
  readonly message?: string;
  /** Accès créés, affichés une seule fois. */
  readonly acces?: AccesCree;
}

export const ETAT_ACTION_INITIAL: EtatAction = { etat: "vierge" };
