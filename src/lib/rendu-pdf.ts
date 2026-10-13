/**
 * Densité de rendu d'une page PDF — cahier des charges ch. 08 (PDF-10).
 *
 * Une page démesurée (affiche, plan d'architecte, bandeau très long) ne doit
 * ni saturer la mémoire d'un téléphone ni dépasser la taille maximale d'un
 * canevas : la densité souhaitée (écran haute définition, au plus ×2) est
 * réduite jusqu'à tenir dans 16 millions de pixels et 16 384 pixels de côté.
 */
export const PIXELS_MAX = 16_000_000;
export const COTE_MAX = 16_384;

export function densiteDeRendu(largeur: number, hauteur: number, ratioEcran: number): number {
  const souhaitee = Math.min(ratioEcran > 0 && Number.isFinite(ratioEcran) ? ratioEcran : 1, 2);
  const l = Math.max(1, largeur);
  const h = Math.max(1, hauteur);
  return Math.min(souhaitee, Math.sqrt(PIXELS_MAX / (l * h)), COTE_MAX / l, COTE_MAX / h);
}
