/**
 * États des actions du Studio — hors des fichiers « use server ».
 *
 * Voir `src/app/(public)/(site)/etablissements/etats.ts` : un fichier
 * « use server » ne peut exporter que des fonctions asynchrones.
 */

export interface EtatStudio {
  readonly etat: "vierge" | "ok" | "erreur";
  readonly message?: string;
  /** Identifiant de l'objet créé, quand l'écran doit y naviguer. */
  readonly cree?: string;
  /**
   * Conflit de version (EDIT-07) : l'objet a changé ailleurs depuis son
   * ouverture. Rien n'est écrasé ; la saisie est rendue ici pour être copiée.
   */
  readonly conflit?: string;
}

export const ETAT_STUDIO_INITIAL: EtatStudio = { etat: "vierge" };
