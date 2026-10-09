"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useId, useRef, useState } from "react";
import { Menu, X } from "lucide-react";
import { MotSymbole } from "./MotSymbole";

/**
 * En-tête du site public — L01.
 *
 * R2 : blanc, 72 px (64 sur téléphone), logo plat à gauche, La plateforme
 * et Pour les lycées ; à droite Se connecter et Demander une démo. Sur
 * téléphone : logo, Connexion visible hors du menu, et un bouton menu de
 * 44 px qui déroule une liste sous l'en-tête.
 *
 * Le menu se ferme avec Échap et rend le focus au bouton — sans quoi on y reste
 * enfermé au clavier.
 */

const LIENS = [
  { href: "/produit", libelle: "La plateforme" },
  { href: "/etablissements", libelle: "Pour les lycées" },
] as const;

export function Entete() {
  const chemin = usePathname();
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
      <div className="contenu-site flex h-16 items-center justify-between gap-4 lg:h-[72px] lg:gap-8">
        <div className="flex items-center gap-10">
          <Link href="/" className="inline-flex min-h-[var(--spacing-cible)] items-center text-[color:var(--color-encre)] no-underline">
            <MotSymbole titre="Study, accueil" className="block h-auto w-[84px] lg:w-[100px]" />
          </Link>

          <nav aria-label="Navigation principale" className="hidden items-center gap-8 lg:flex">
            {LIENS.map((lien) => (
              <Link
                key={lien.href}
                href={lien.href}
                aria-current={chemin === lien.href ? "page" : undefined}
                className="inline-flex min-h-[var(--spacing-cible)] items-center text-[0.9375rem] font-semibold text-[color:var(--color-encre-faible)] no-underline transition-colors duration-[120ms] hover:text-[color:var(--color-encre)]"
              >
                {lien.libelle}
              </Link>
            ))}
          </nav>
        </div>

        <div className="hidden items-center gap-6 lg:flex">
          <Link
            href="/connexion"
            className="inline-flex min-h-[var(--spacing-cible)] items-center text-[0.9375rem] font-bold text-[color:var(--color-encre)] no-underline hover:text-[color:var(--color-accent)]"
          >
            Se connecter
          </Link>
          <Link href="/contact" className="bouton bouton-primaire">
            Demander une démo
          </Link>
        </div>

        <div className="flex items-center gap-2 lg:hidden">
          <Link href="/connexion" className="bouton bouton-primaire min-h-11 px-4 text-[0.9375rem]">
            Connexion
          </Link>
          <button
            ref={bouton}
            type="button"
            onClick={() => setOuvert((valeur) => !valeur)}
            aria-expanded={ouvert}
            aria-controls={identifiantMenu}
            className="flex h-11 w-11 items-center justify-center rounded-[var(--radius-bouton)] border border-[color:var(--color-bordure-forte)] bg-[color:var(--color-surface)] text-[color:var(--color-encre)]"
          >
            <span className="sr-only">{ouvert ? "Fermer le menu" : "Ouvrir le menu"}</span>
            {ouvert ? <X size={22} strokeWidth={1.75} aria-hidden="true" /> : <Menu size={22} strokeWidth={1.75} aria-hidden="true" />}
          </button>
        </div>
      </div>

      {/* Liste déroulante sous l'en-tête : pas un nouvel écran opaque. */}
      <div ref={panneau} id={identifiantMenu} hidden={!ouvert} className="border-t border-[color:var(--color-bordure)] bg-[color:var(--color-surface)] lg:hidden">
        <nav aria-label="Menu" className="contenu-site grid py-2">
          {LIENS.map((lien) => (
            <Link
              key={lien.href}
              href={lien.href}
                aria-current={chemin === lien.href ? "page" : undefined}
              onClick={() => fermer()}
              className="flex min-h-12 items-center border-b border-[color:var(--color-bordure)] text-[1rem] font-semibold no-underline"
            >
              {lien.libelle}
            </Link>
          ))}
          <Link href="/aide" onClick={() => fermer()} className="flex min-h-12 items-center border-b border-[color:var(--color-bordure)] text-[1rem] font-semibold no-underline">
            Aide
          </Link>
          <Link href="/contact" onClick={() => fermer()} className="bouton bouton-secondaire mb-2 mt-3">
            Demander une démo
          </Link>
        </nav>
      </div>
    </header>
  );
}
