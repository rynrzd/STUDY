import type { AccesEleve } from "@/lib/etablissement";
import type { LigneImport, Resume } from "@/lib/import-rentree";

/**
 * État de l'import de rentrée — hors du fichier d'action.
 *
 * Voir `src/app/(public)/(site)/etablissements/etats.ts` : un fichier
 * `"use server"` ne peut exporter que des fonctions asynchrones.
 */

export interface EtatImport {
  readonly etape: "depot" | "apercu" | "termine" | "erreur";
  readonly message?: string;
  readonly resume?: Resume;
  readonly lignes?: LigneImport[];
  readonly classes?: string[];
  readonly empreinte?: string;
  readonly acces?: AccesEleve[];
  readonly echecs?: { ligne: number; raison: string }[];
}

export const ETAT_IMPORT_INITIAL: EtatImport = { etape: "depot" };
