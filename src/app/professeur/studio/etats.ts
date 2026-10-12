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

/**
 * Publication dans plusieurs cours — cahier des charges, ch. 14.
 *
 * `partiel` existe pour ne jamais annoncer un succès global quand une cible a
 * été refusée : chaque cours a sa ligne, avec son issue et sa raison.
 */
export interface ResultatPublication {
  readonly cible: string;
  readonly libelle: string;
  readonly resultat: "publiee" | "mise_a_jour" | "deja_publiee" | "programmee" | "refusee";
  readonly seance: string | null;
  readonly raison: string | null;
}

export interface EtatPublication {
  readonly etat: "vierge" | "ok" | "partiel" | "erreur";
  readonly message?: string;
  readonly resultats?: readonly ResultatPublication[];
}

export const ETAT_PUBLICATION_INITIAL: EtatPublication = { etat: "vierge" };

/** Ce que l'éditeur envoie au serveur à chaque sauvegarde. */
export interface Brouillon {
  readonly document: DocumentCours;
  readonly reglages: ReglagesPresentation;
}
