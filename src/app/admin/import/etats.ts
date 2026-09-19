import type { AccesCree } from "@/lib/lot-rentree";

/**
 * États des formulaires de l'assistant de rentrée.
 *
 * Ils vivent ici, et non dans `actions.ts` : un fichier `"use server"` ne peut
 * exporter que des fonctions asynchrones. La règle est tenue par
 * `tests/unite/actions-serveur.test.ts`.
 */

export interface EtatDepot {
  readonly etat: "vierge" | "erreur";
  readonly message?: string;
}

export const ETAT_DEPOT_INITIAL: EtatDepot = { etat: "vierge" };

export interface EtatCorrection {
  readonly etat: "vierge" | "ok" | "erreur";
  readonly message?: string;
}

export const ETAT_CORRECTION_INITIAL: EtatCorrection = { etat: "vierge" };

/**
 * Le compte rendu de création (§5.7).
 *
 * `acces` ne traverse ce chemin qu'une fois : les mots de passe temporaires
 * n'existent qu'ici, entre leur génération et l'impression. Rien ne les
 * conserve, ni en base ni en session — les redemander est impossible, et
 * l'écran le dit.
 */
export interface EtatCreation {
  readonly etat: "vierge" | "termine" | "erreur";
  readonly message?: string;
  readonly cree?: number;
  readonly existant?: number;
  readonly reinscrit?: number;
  readonly erreurs?: number;
  readonly acces?: readonly AccesCree[];
  readonly echecs?: readonly { ligne: number; raison: string }[];
}

export const ETAT_CREATION_INITIAL: EtatCreation = { etat: "vierge" };
