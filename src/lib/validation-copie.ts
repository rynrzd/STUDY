import { TAILLE_MAX_DEPOT } from "./limites-depot.ts";

/** Première explication locale ; le serveur reste seul juge du type et du dépôt. */
export function verifierSelectionCopie(fichier: Pick<File, "size"> | null): string | null {
  if (fichier === null || fichier.size === 0) return "Choisis un fichier à remettre.";
  if (fichier.size > TAILLE_MAX_DEPOT) {
    return "Ce fichier dépasse 4 Mo. Choisis une version moins volumineuse.";
  }
  return null;
}
