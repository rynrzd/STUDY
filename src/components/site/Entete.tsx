"use client";

import Link from "next/link";
import { useEffect, useId, useRef, useState } from "react";
import { MARQUE } from "@/lib/identite-legale";

/**
 * En-tête du site public — L01.
 *
 * Blanc, 72 px, mot-symbole à gauche, deux liens, deux actions. Sur téléphone,
 * la navigation se replie derrière un bouton : elle ne doit jamais recouvrir le
 * titre du hero, qui est la première chose qu'on vient lire.
 *
 * Le menu se ferme avec Échap et rend le focus au bouton — sans quoi on y reste
 * enfermé au clavier.
 */

const LIENS = [
  { href: "/produit", libelle: "La plateforme" },
  { href: "/etablissements", libelle: "Pour les lycées" },
] as const;

export function Entete() {
  const [ouvert, setOuvert] = useState(false);

  const bouton = useRef<HTMLButtonElement>(null);
  const panneau = useRef<HTMLDivElement>(null);
  const identifiantMenu = useId();

  /**
   * Fermer, et rendre le focus au bouton.
   *
   * La restitution n'est pas un détail : quand on ferme depuis un lien du
   * menu, l'élément qui avait le focus vient de disparaître. Sans cette
   * ligne, le focus retombe sur `<body>` et la tabulation suivante repart du
   * haut de la page — on perd sa place.
   */
  function fermer(rendreLeFocus = true) {
    setOuvert(false);
    if (rendreLeFocus) bouton.current?.focus();
  }

  useEffect(() => {
    if (!ouvert) return;

    const auClavier = (evenement: KeyboardEvent) => {
      if (evenement.key === "Escape") fermer();
    };

    /**
     * Un clic en dehors ferme le menu.
     *
     * On écoute sur `pointerdown` plutôt que `click` : un `click` part après
     * le relâchement, donc après qu'un lien situé sous le menu a déjà pu
     * recevoir le sien. On regarde si le point touché est dans le panneau ou
     * sur le bouton — pour le bouton, c'est sa propre bascule qui joue, sinon
     * il fermerait puis rouvrirait aussitôt.
     */
    const auPointeur = (evenement: PointerEvent) => {
      const cible = evenement.target as Node | null;
      if (cible === null) return;
      if (panneau.current?.contains(cible) === true) return;
      if (bouton.current?.contains(cible) === true) return;
      fermer(false);
    };

    document.addEventListener("keydown", auClavier);
    document.addEventListener("pointerdown", auPointeur);

    // Le fond ne défile plus sous le menu ouvert. On restitue la valeur
    // précédente plutôt que d'écrire « visible » en dur : une autre partie de
    // l'application pourrait l'avoir posée, et on n'a pas à en décider ici.
    const defilementPrecedent = document.body.style.overflow;
    document.body.style.overflow = "hidden";

    return () => {
      document.removeEventListener("keydown", auClavier);
      document.removeEventListener("pointerdown", auPointeur);
      document.body.style.overflow = defilementPrecedent;
    };
  }, [ouvert]);

  return (
    <header className="sticky top-0 z-30 border-b border-[color:var(--color-bordure)] bg-[color:var(--color-surface)]">
      <div className="contenu-site flex h-[72px] items-center justify-between gap-6">
        {/* Le mot-symbole et les deux liens forment un seul groupe à gauche :
            c'est la composition de la référence, et elle se lit mieux qu'une
            navigation centrée qui flotte entre deux blocs. */}
        <div className="flex items-center gap-9">
          <Link
            href="/"
            /* La marque est le lien de retour a l accueil : sur telephone elle se
               touche, donc elle a la hauteur d une cible (V5 §11). */
            className="marque inline-flex min-h-[var(--spacing-cible)] items-center text-[1.375rem] no-underline"
          >
            {MARQUE}.
          </Link>

          <nav aria-label="Navigation principale" className="hidden items-center gap-7 md:flex">
            {LIENS.map((lien) => (
              <Link
                key={lien.href}
                href={lien.href}
                className="text-[length:var(--text-tableau)] text-[color:var(--color-encre-faible)] no-underline transition-colors duration-[120ms] hover:text-[color:var(--color-encre)]"
              >
                {lien.libelle}
              </Link>
            ))}
          </nav>
        </div>

        <div className="hidden items-center gap-4 md:flex">
          <Link
            href="/connexion"
            className="text-[length:var(--text-tableau)] text-[color:var(--color-encre)] no-underline"
          >
            Se connecter
          </Link>
          <Link href="/etablissements" className="bouton bouton-primaire bouton-compact">
            Demander une démo
          </Link>
        </div>

        <button
          ref={bouton}
          type="button"
          onClick={() => setOuvert((valeur) => !valeur)}
          aria-expanded={ouvert}
          aria-controls={identifiantMenu}
          className="flex h-11 w-11 items-center justify-center rounded-[var(--radius-champ)] border border-[color:var(--color-bordure)] md:hidden"
        >
          <span className="sr-only">{ouvert ? "Fermer le menu" : "Ouvrir le menu"}</span>
          <span aria-hidden="true" className="text-[1.125rem]">
            {ouvert ? "✕" : "☰"}
          </span>
        </button>
      </div>

      <div
        ref={panneau}
        id={identifiantMenu}
        hidden={!ouvert}
        className="border-t border-[color:var(--color-bordure)] md:hidden"
      >
        <nav aria-label="Navigation" className="contenu-site flex flex-col py-3">
          {LIENS.map((lien) => (
            <Link
              key={lien.href}
              href={lien.href}
              onClick={() => fermer()}
              className="flex min-h-[var(--spacing-cible)] items-center text-[length:var(--text-corps)] no-underline"
            >
              {lien.libelle}
            </Link>
          ))}
          <Link
            href="/connexion"
            onClick={() => fermer()}
            className="flex min-h-[var(--spacing-cible)] items-center text-[length:var(--text-corps)] no-underline"
          >
            Se connecter
          </Link>
          <Link
            href="/etablissements"
            onClick={() => fermer()}
            className="bouton bouton-primaire mt-2"
          >
            Demander une démo
          </Link>
        </nav>
      </div>
    </header>
  );
}
