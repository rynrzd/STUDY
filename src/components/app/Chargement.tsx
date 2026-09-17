/**
 * Écrans d'attente des espaces connectés.
 *
 * Chaque page de ces espaces interroge la base avant de rendre quoi que ce
 * soit. Sans écran d'attente, cliquer sur « Mes classes » ne produit rien de
 * visible pendant le temps de la requête — sur le réseau d'un lycée, cela peut
 * durer une seconde ou deux, et on reclique. Next affiche ces composants
 * immédiatement, pendant que le serveur travaille.
 *
 * Ce sont des **squelettes de la vraie page**, pas un tourniquet centré : la
 * forme de ce qui arrive est déjà là, donc la page ne saute pas quand le
 * contenu la remplace. C'est aussi ce qui évite le décalage de mise en page
 * que mesure le CLS.
 *
 * Le texte pour lecteur d'écran est annoncé une fois, poliment : « Chargement »
 * répété à chaque navigation deviendrait insupportable.
 */

export function Barre({
  largeur = "100%",
  hauteur = "1rem",
  className = "",
}: {
  largeur?: string;
  hauteur?: string;
  className?: string;
}) {
  return (
    <span
      aria-hidden="true"
      className={`squelette block ${className}`}
      style={{ width: largeur, height: hauteur }}
    />
  );
}

/** Le titre de page et son sous-titre. */
export function TitreEnAttente() {
  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div className="min-w-0 flex-1">
        <Barre largeur="min(18rem, 60%)" hauteur="1.75rem" />
        <Barre largeur="min(12rem, 40%)" hauteur="0.875rem" className="mt-2.5" />
      </div>
      <Barre largeur="9rem" hauteur="2.75rem" />
    </div>
  );
}

/** Une liste de lignes, comme celles des devoirs, des séances ou des classes. */
export function ListeEnAttente({ lignes = 5 }: { lignes?: number }) {
  return (
    <ul className="m-0 mt-4 list-none p-0">
      {Array.from({ length: lignes }).map((_, rang) => (
        <li
          key={rang}
          className="flex min-h-[var(--spacing-cible)] items-center justify-between gap-4 border-b border-[color:var(--color-bordure)] py-3.5"
        >
          <span className="min-w-0 flex-1">
            <Barre largeur={`${70 - rang * 6}%`} hauteur="0.9375rem" />
            <Barre largeur="6rem" hauteur="0.75rem" className="mt-2" />
          </span>
          <Barre largeur="4.5rem" hauteur="1.5rem" />
        </li>
      ))}
    </ul>
  );
}

/** Une rangée de cartes, comme les cours du jour ou les compteurs. */
export function CartesEnAttente({ nombre = 4 }: { nombre?: number }) {
  return (
    <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
      {Array.from({ length: nombre }).map((_, rang) => (
        <div key={rang} className="carte p-5">
          <Barre largeur="55%" hauteur="0.75rem" />
          <Barre largeur="80%" hauteur="1.25rem" className="mt-3" />
        </div>
      ))}
    </div>
  );
}

/**
 * L'écran d'attente complet d'un espace.
 *
 * `role="status"` et `aria-busy` annoncent l'attente une fois. Le squelette
 * lui-même est masqué aux technologies d'assistance : leur lire une suite de
 * rectangles n'apporte rien.
 */
export function EspaceEnAttente({
  cartes = 4,
  lignes = 5,
}: {
  cartes?: number;
  lignes?: number;
}) {
  return (
    <div role="status" aria-busy="true">
      <span className="sr-only">Chargement de la page.</span>

      <TitreEnAttente />
      <CartesEnAttente nombre={cartes} />

      <div className="mt-11">
        <Barre largeur="min(14rem, 50%)" hauteur="1.25rem" />
        <ListeEnAttente lignes={lignes} />
      </div>
    </div>
  );
}
