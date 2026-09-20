"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
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

  useEffect(() => {
    if (!ouvert) return;
    const fermer = (evenement: KeyboardEvent) => {
      if (evenement.key === "Escape") setOuvert(false);
    };
    document.addEventListener("keydown", fermer);
    return () => document.removeEventListener("keydown", fermer);
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
          type="button"
          onClick={() => setOuvert((valeur) => !valeur)}
          aria-expanded={ouvert}
          aria-controls="menu-mobile"
          className="flex h-11 w-11 items-center justify-center rounded-[var(--radius-champ)] border border-[color:var(--color-bordure)] md:hidden"
        >
          <span className="sr-only">{ouvert ? "Fermer le menu" : "Ouvrir le menu"}</span>
          <span aria-hidden="true" className="text-[1.125rem]">
            {ouvert ? "✕" : "☰"}
          </span>
        </button>
      </div>

      <div
        id="menu-mobile"
        hidden={!ouvert}
        className="border-t border-[color:var(--color-bordure)] md:hidden"
      >
        <nav aria-label="Navigation" className="contenu-site flex flex-col py-3">
          {LIENS.map((lien) => (
            <Link
              key={lien.href}
              href={lien.href}
              onClick={() => setOuvert(false)}
              className="flex min-h-[var(--spacing-cible)] items-center text-[length:var(--text-corps)] no-underline"
            >
              {lien.libelle}
            </Link>
          ))}
          <Link
            href="/connexion"
            onClick={() => setOuvert(false)}
            className="flex min-h-[var(--spacing-cible)] items-center text-[length:var(--text-corps)] no-underline"
          >
            Se connecter
          </Link>
          <Link
            href="/etablissements"
            onClick={() => setOuvert(false)}
            className="bouton bouton-primaire mt-2"
          >
            Demander une démo
          </Link>
        </nav>
      </div>
    </header>
  );
}
