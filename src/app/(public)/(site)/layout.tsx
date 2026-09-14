import { LARGEUR } from "@/components/public/Chrome";

/**
 * Pages publiques secondaires : offre, sécurité, aide, pages légales…
 *
 * Toutes partagent le même conteneur de 1 200 px avec gouttières (ch. 03).
 * Seule la landing s'en affranchit, pour ses bandes pleine largeur.
 */
export default function GabaritSite({ children }: { children: React.ReactNode }) {
  return (
    <main id="contenu" className={LARGEUR}>
      {children}
    </main>
  );
}
