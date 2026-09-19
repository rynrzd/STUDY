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
}

export const ETAT_ADMIN_INITIAL: EtatAdmin = { etat: "vierge" };
