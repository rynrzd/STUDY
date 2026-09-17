import { Barre, ListeEnAttente } from "@/components/app/Chargement";

/**
 * Écran d'attente du Studio.
 *
 * La zone de dépôt occupe le haut de l'écran : son gabarit est réservé dès le
 * départ, pour que la page ne saute pas quand elle arrive.
 */
export default function Chargement() {
  return (
    <div role="status" aria-busy="true">
      <span className="sr-only">Chargement du Studio.</span>

      <Barre largeur="min(22rem, 70%)" hauteur="1.75rem" />
      <Barre largeur="min(28rem, 85%)" hauteur="1rem" className="mt-3" />

      <div className="squelette mt-8 h-[11rem] w-full rounded-[var(--radius-carte)]" aria-hidden="true" />

      <div className="mt-12">
        <Barre largeur="12rem" hauteur="1.25rem" />
        <ListeEnAttente lignes={4} />
      </div>
    </div>
  );
}
