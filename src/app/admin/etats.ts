import type { AccesCree, AccesEleve } from "@/lib/etablissement";
import type { LigneImport, Resume } from "@/lib/import-rentree";

/**
 * États des formulaires d'administration — hors du fichier d'action.
 *
 * Un fichier `"use server"` ne peut exporter que des fonctions asynchrones :
 * y laisser une constante casse toutes les actions du fichier, à l'exécution
 * seulement. La règle est vérifiée par `tests/unite/actions-serveur.test.ts`.
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

/**
 * État des gestes unitaires : créer une classe, un compte, une affectation.
 *
 * `acces` n'est renseigné qu'une fois, au retour d'une création de compte :
 * c'est le seul moment où le mot de passe temporaire existe de notre côté.
 */
export interface EtatAdmin {
  readonly etat: "vierge" | "ok" | "erreur";
  readonly message?: string;
  readonly acces?: AccesCree;
}

export const ETAT_ADMIN_INITIAL: EtatAdmin = { etat: "vierge" };
