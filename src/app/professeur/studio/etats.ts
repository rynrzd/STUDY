import type { DocumentCours, ReglagesPresentation } from "@/lib/document-cours";

/**
 * États des actions du Studio — hors du fichier d'action.
 *
 * Un fichier `"use server"` ne peut exporter que des fonctions asynchrones.
 */

export interface EtatImportStudio {
  readonly etat: "vierge" | "envoi" | "erreur";
  readonly message?: string;
  /** Identifiant du document créé, pour ouvrir l'éditeur. */
  readonly document?: string;
}

export const ETAT_IMPORT_STUDIO: EtatImportStudio = { etat: "vierge" };

/**
 * Retour d'une sauvegarde — S12.
 *
 * `revision` est le numéro que le serveur a enregistré. L'éditeur le renvoie à
 * la sauvegarde suivante : si la base en a un plus récent, c'est qu'un second
 * onglet a écrit entre-temps, et on refuse plutôt que d'écraser.
 */
export interface EtatSauvegarde {
  readonly etat: "vierge" | "enregistre" | "conflit" | "erreur";
  readonly message?: string;
  readonly revision?: number;
}

export const ETAT_SAUVEGARDE_INITIAL: EtatSauvegarde = { etat: "vierge" };

export interface EtatPublication {
  readonly etat: "vierge" | "ok" | "erreur";
  readonly message?: string;
}

export const ETAT_PUBLICATION_INITIAL: EtatPublication = { etat: "vierge" };

/** Ce que l'éditeur envoie au serveur à chaque sauvegarde. */
export interface Brouillon {
  readonly document: DocumentCours;
  readonly reglages: ReglagesPresentation;
}
