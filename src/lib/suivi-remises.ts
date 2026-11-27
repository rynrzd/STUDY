/**
 * L'état d'une remise peut passer de `remis` à `retour_disponible` ou
 * `a_reprendre` après la correction. Cela ne signifie jamais que l'élève
 * n'a plus rendu sa copie. Les compteurs et filtres doivent donc utiliser
 * la présence de la remise, indépendamment de la publication du retour.
 */
export interface EtatSuiviRemise {
  readonly etat: string;
  readonly derniere: { readonly enRetard: boolean } | null;
}

export function remiseEffectuee(ligne: EtatSuiviRemise): boolean {
  return ligne.derniere !== null || [
    "remis",
    "remis_en_retard",
    "retour_disponible",
    "a_reprendre",
  ].includes(ligne.etat);
}

export function remiseEnRetard(ligne: EtatSuiviRemise): boolean {
  return remiseEffectuee(ligne) && (
    ligne.derniere?.enRetard === true || ligne.etat === "remis_en_retard"
  );
}

/** Le sélecteur papier accepte trois états, même après une correction. */
export function etatPourRemisePapier(ligne: EtatSuiviRemise): "non_commence" | "remis" | "remis_en_retard" {
  if (!remiseEffectuee(ligne)) return "non_commence";
  return remiseEnRetard(ligne) ? "remis_en_retard" : "remis";
}
