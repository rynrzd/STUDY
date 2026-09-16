/**
 * Pages publiques secondaires : produit, offre, sécurité, aide, pages légales.
 *
 * Elles composent leurs propres sections, qui portent déjà le conteneur de
 * 1 220 px. Ce gabarit ne fait que poser la cible du lien d'évitement.
 */
export default function GabaritSite({ children }: { children: React.ReactNode }) {
  return <main id="contenu">{children}</main>;
}
