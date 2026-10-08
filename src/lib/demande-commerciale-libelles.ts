/**
 * Libellés des demandes commerciales : types d'établissement et états de
 * suivi. Module sans dépendance, importable côté client — le reste de
 * `demande-commerciale` (signature HMAC, validation) ne doit jamais partir
 * dans le navigateur, et ce fichier est là pour que personne n'ait à
 * l'importer depuis un composant client.
 */
export const TYPES_ETABLISSEMENT = [
  { valeur: "public", libelle: "Établissement public" },
  { valeur: "prive", libelle: "Établissement privé sous contrat" },
  { valeur: "autre", libelle: "Autre structure" },
] as const;

export const ETATS = [
  { valeur: "nouvelle", libelle: "Nouvelle" },
  { valeur: "contactee", libelle: "Contactée" },
  { valeur: "devis_envoye", libelle: "Devis envoyé" },
  { valeur: "gagnee", libelle: "Gagnée" },
  { valeur: "perdue", libelle: "Perdue" },
] as const;

export type Etat = (typeof ETATS)[number]["valeur"];

export function libelleEtat(etat: string): string {
  return ETATS.find((element) => element.valeur === etat)?.libelle ?? etat;
}
