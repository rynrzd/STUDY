/**
 * États des actions de l'espace élève — hors du fichier d'action.
 *
 * Un fichier `"use server"` ne peut exporter que des fonctions asynchrones :
 * la règle est vérifiée par `tests/unite/actions-serveur.test.ts`.
 */

export interface EtatEleve {
  readonly etat: "vierge" | "ok" | "erreur";
  readonly message?: string;
}

export const ETAT_ELEVE_INITIAL: EtatEleve = { etat: "vierge" };
