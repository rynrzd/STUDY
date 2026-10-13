import type { AccesCree } from "@/lib/etablissement";

/**
 * États des formulaires d'administration — hors du fichier d'action.
 *
 * Un fichier `"use server"` ne peut exporter que des fonctions asynchrones :
 * y laisser une constante casse toutes les actions du fichier, à l'exécution
 * seulement. La règle est vérifiée par `tests/unite/actions-serveur.test.ts`.
 */

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
  /**
   * Création de classe (CL-02) : une classe équivalente existe déjà (« 2nde 1 »
   * pour « Seconde 1 »). L'écran la nomme et demande confirmation ; la saisie
   * est rendue pour ne pas être perdue.
   */
  readonly equivalente?: string;
  readonly saisie?: string;
}

export const ETAT_ADMIN_INITIAL: EtatAdmin = { etat: "vierge" };

/** Affectation multiple : l'issue de chaque ligne, dans l'ordre de la demande (rang 1, 2…). */
export interface EtatAffectations {
  readonly etat: "vierge" | "ok" | "partiel" | "erreur";
  readonly message?: string;
  readonly issues?: readonly { readonly rang: number; readonly resultat: "creee" | "existante" | "refusee"; readonly raison: string | null }[];
}

export const ETAT_AFFECTATIONS_INITIAL: EtatAffectations = { etat: "vierge" };
