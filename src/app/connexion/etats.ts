/**
 * États des formulaires de connexion — hors du fichier d'action.
 *
 * Voir `src/app/(public)/(site)/etablissements/etats.ts` : un fichier
 * `"use server"` ne peut exporter que des fonctions asynchrones.
 */

/**
 * Nature d'un refus. Chacune a son message, et l'interface la place au bon
 * endroit :
 * - `saisie` : un champ manque ; le message va sous le champ ;
 * - `identifiants` : identifiant ou mot de passe faux, compte inconnu ou
 *   indisponible — **un seul message pour tous ces cas** (non-divulgation) ;
 * - `limite` : trop de tentatives, avec le délai ;
 * - `service` : le service d'identité ou la base ne répond pas ;
 * - `reseau` : la requête n'est pas partie (posé côté navigateur) ;
 * - `etablissement` : le contexte établissement manque ou a expiré.
 */
export type TypeRefus = "saisie" | "identifiants" | "limite" | "service" | "reseau" | "etablissement";

export interface EtatConnexion {
  readonly etat: "vierge" | "refus";
  readonly type?: TypeRefus;
  readonly message?: string;
  readonly champs?: Partial<Record<"identifiant" | "motDePasse", string>>;
  readonly reprendreDansSecondes?: number;
  /**
   * Ce qui est réaffiché après un refus : l'identifiant. Le mot de passe ne
   * repart jamais vers le navigateur.
   */
  readonly saisie?: { readonly identifiant: string };
}

export const ETAT_INITIAL: EtatConnexion = { etat: "vierge" };

export interface EtatEtablissement {
  readonly etat: "vierge" | "refus";
  readonly message?: string;
  readonly code?: string;
}

export const ETAT_ETABLISSEMENT_INITIAL: EtatEtablissement = { etat: "vierge" };
