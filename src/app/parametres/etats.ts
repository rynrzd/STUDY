/**
 * État de l'écran des paramètres — hors du fichier d'action.
 *
 * Un fichier `"use server"` ne peut exporter que des fonctions asynchrones.
 */

export interface EtatParametres {
  readonly etat: "vierge" | "ok" | "erreur";
  readonly message?: string;
}

export const ETAT_PARAMETRES_INITIAL: EtatParametres = { etat: "vierge" };
