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

/** Le compte rendu de creation des professeurs (§6).
 *
 * `affectations` compte les triplets professeur–matière–classe réellement
 * posés. Il est distinct du nombre de comptes : c'est précisément la
 * distinction que le §6.2 demande de rendre visible.
 */
export interface EtatCreationProfesseurs {
  readonly etat: "vierge" | "termine" | "erreur";
  readonly message?: string;
  readonly cree?: number;
  readonly existant?: number;
  readonly affectations?: number;
  readonly erreurs?: number;
  readonly acces?: readonly AccesCree[];
  readonly echecs?: readonly { ligne: number; raison: string }[];
}

export const ETAT_CREATION_PROFS_INITIAL: EtatCreationProfesseurs = { etat: "vierge" };

/**
 * Étape « Vérifier les colonnes » (cahier des charges ch. 17, étape 2) : ce
 * que l'analyse a compris de chaque fichier, colonne par colonne, avec un
 * échantillon. Rien n'est enregistré à cette étape (IMP-01).
 */
export interface ColonneApercu {
  readonly index: number;
  readonly entete: string;
  readonly champ: string | null;
  readonly confiance: "sur" | "a_confirmer" | "non_reconnu";
  readonly exemple: string;
}

export interface FichierColonnes {
  readonly nom: string;
  readonly colonnes: readonly ColonneApercu[];
  /** Les trois premières lignes, pour juger sur pièce. */
  readonly echantillon: readonly (readonly string[])[];
  readonly lignes: number;
  readonly erreur: string | null;
}

export interface EtatColonnes {
  readonly etat: "vierge" | "ok" | "erreur";
  readonly message?: string;
  readonly fichiers?: readonly FichierColonnes[];
}

export const ETAT_COLONNES_INITIAL: EtatColonnes = { etat: "vierge" };

/** Import de groupes (0079) : l'aperçu, puis l'application, sur le même fichier. */
export interface EtatImportGroupes {
  readonly etat: "vierge" | "ok" | "erreur";
  readonly message?: string;
  readonly resultat?: import("@/lib/etablissement").ResultatImportGroupes;
}

export const ETAT_IMPORT_GROUPES_INITIAL: EtatImportGroupes = { etat: "vierge" };
