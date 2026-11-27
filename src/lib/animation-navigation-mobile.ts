/** Une étape du ressort (60 images/s = facteur 1), indépendante du navigateur. */
export function etapeRessort(
  position: number,
  vitesse: number,
  cible: number,
  facteur = 1,
): { position: number; vitesse: number } {
  const pas = Math.max(0.2, Math.min(facteur, 2));
  const nouvelleVitesse = (vitesse + (cible - position) * 0.075 * pas) * Math.pow(0.7, pas);
  return {
    position: Math.max(6, Math.min(94, position + nouvelleVitesse * pas)),
    vitesse: nouvelleVitesse,
  };
}
