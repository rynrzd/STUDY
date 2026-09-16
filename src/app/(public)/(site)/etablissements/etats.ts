/**
 * État du formulaire de demande — hors du fichier d'action.
 *
 * Un fichier marqué `"use server"` ne peut exporter que des fonctions
 * asynchrones : Next transforme chacun de ses exports en point d'entrée
 * appelable depuis le navigateur, et un objet n'en est pas un. Exporter une
 * constante depuis un tel fichier fait échouer le module **à l'exécution**,
 * pas à la compilation — le build passe, et le premier envoi de formulaire
 * répond 500.
 *
 * Les états initiaux vivent donc ici, dans un module ordinaire, partagé par
 * l'action et par le composant client. `tests/unite/actions-serveur.test.ts`
 * vérifie qu'aucun fichier d'action ne recommence.
 */

export interface EtatFormulaire {
  readonly etat: "vierge" | "erreur" | "envoye" | "indisponible";
  readonly reference?: string;
  readonly message?: string;
  readonly champs?: Record<string, string>;
  /** Vrai quand la demande existait déjà : on réaffiche sa référence. */
  readonly dejaRecue?: boolean;
}

export const ETAT_INITIAL: EtatFormulaire = { etat: "vierge" };
