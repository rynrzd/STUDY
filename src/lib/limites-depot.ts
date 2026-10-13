/** Transport multipart : marge sous le plafond de l'hébergement, champs compris. */
export const TAILLE_MAX_DEPOT = 4_000_000;
export const CORPS_MAX_DEPOT = 4_200_000;
export const LIMITE_DEPOT_LIBELLE = "4 Mo";

/** Partagé par les formulaires et le serveur ; tient compte du cumul des fichiers. */
export function erreurTailleDepot(donnees: FormData): string | null {
  let fichiers = 0;
  let champs = 0;
  for (const [nom, valeur] of donnees) {
    champs += new TextEncoder().encode(nom).length + 512;
    if (typeof valeur === "string") champs += new TextEncoder().encode(valeur).length;
    else fichiers += valeur.size;
  }
  return fichiers > TAILLE_MAX_DEPOT || fichiers + champs > CORPS_MAX_DEPOT - 20_000
    ? "L’envoi dépasse 4 Mo. Réduisez le fichier ou envoyez les fichiers en plusieurs fois."
    : null;
}
