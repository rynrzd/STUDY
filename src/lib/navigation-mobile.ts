/** Configuration d'une destination de la navigation du téléphone. */
export interface CibleNavigationMobile {
  readonly href: string;
  readonly exact?: boolean;
  readonly aussi?: readonly string[];
}

/** Un préfixe ne doit jamais activer une autre route qui commence pareil. */
export function destinationActive(chemin: string, cible: CibleNavigationMobile): boolean {
  if (cible.exact) return chemin === cible.href;
  return [cible.href, ...(cible.aussi ?? [])].some((p) => chemin === p || chemin.startsWith(`${p}/`));
}

export function indexNavigationMobile(
  chemin: string,
  principales: readonly CibleNavigationMobile[],
  autres: readonly CibleNavigationMobile[],
): number {
  const principale = principales.findIndex((cible) => destinationActive(chemin, cible));
  if (principale >= 0) return principale;
  return autres.some((cible) => destinationActive(chemin, cible)) ? 4 : -1;
}
