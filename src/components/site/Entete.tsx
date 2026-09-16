"use client";

import Link from "next/link";
import { useEffect, useId, useState } from "react";
import { MARQUE } from "@/lib/identite-legale";

/**
 * Navigation du site public — cahier V2, §4.1.
 *
 * Logo à gauche, quatre ancres, puis les deux actions : se connecter et
 * découvrir. L'en-tête est transparent en haut de page et devient blanc au
 * défilement — rien de plus, pas d'ombre ni de flou marqué.
 *
 * Sur mobile, la connexion reste atteignable sans ouvrir le menu : c'est le
 * geste le plus fréquent d'un élève qui arrive sur le site.
 */

const LIENS = [
  { href: "/#fonctionnement", libelle: "Fonctionnement" },
  { href: "/#professeurs", libelle: "Professeurs" },
  { href: "/#eleves", libelle: "Élèves" },
  { href: "/#etablissements", libelle: "Établissements" },
] as const;

export function Entete() {
  const [defile, setDefile] = useState(false);
  const [ouvert, setOuvert] = useState(false);
  const base = useId();

  useEffect(() => {
    const auDefilement = () => setDefile(window.scrollY > 8);
    auDefilement();
    window.addEventListener("scroll", auDefilement, { passive: true });
    return () => window.removeEventListener("scroll", auDefilement);
  }, []);

  useEffect(() => {
    if (!ouvert) return;
    const auClavier = (evenement: KeyboardEvent) => {
      if (evenement.key === "Escape") setOuvert(false);
    };
    document.addEventListener("keydown", auClavier);
    return () => document.removeEventListener("keydown", auClavier);
  }, [ouvert]);

  return (
    <header className="entete" data-defile={defile}>
      <div className="contenu flex h-[66px] items-center justify-between gap-6">
        <Link
          href="/"
          onClick={() => setOuvert(false)}
          className="text-[1.3125rem] font-extrabold tracking-[-0.035em] text-[color:var(--color-encre)] no-underline"
        >
          {MARQUE}
        </Link>

        <nav aria-label="Navigation principale" className="hidden lg:block">
          <ul className="m-0 flex list-none items-center gap-7 p-0">
            {LIENS.map((lien) => (
              <li key={lien.href}>
                <Link
                  href={lien.href}
                  className="text-[length:var(--text-tableau)] font-medium text-[color:var(--color-encre-faible)] no-underline transition-colors hover:text-[color:var(--color-encre)]"
                >
                  {lien.libelle}
                </Link>
              </li>
            ))}
          </ul>
        </nav>

        <div className="flex items-center gap-2">
          <Link href="/connexion" className="bouton bouton-discret bouton-compact sm:min-h-[var(--spacing-cible)] sm:text-[length:var(--text-corps)]">
            Se connecter
          </Link>
          <Link
            href="/#decouvrir"
            className="bouton bouton-rose bouton-compact hidden sm:inline-flex sm:min-h-[var(--spacing-cible)] sm:text-[length:var(--text-corps)]"
          >
            Découvrir AvecStudy
          </Link>

          <button
            type="button"
            aria-expanded={ouvert}
            aria-controls={`${base}-menu`}
            aria-label={ouvert ? "Fermer le menu" : "Ouvrir le menu"}
            onClick={() => setOuvert(!ouvert)}
            className="bouton bouton-secondaire bouton-compact px-3 lg:hidden"
          >
            <span aria-hidden="true" className="flex flex-col gap-[4px]">
              <span className="block h-[2px] w-[16px] bg-current" />
              <span className="block h-[2px] w-[16px] bg-current" />
            </span>
            Menu
          </button>
        </div>
      </div>

      <div
        id={`${base}-menu`}
        hidden={!ouvert}
        className="border-t border-[color:var(--color-bordure)] bg-[color:var(--color-surface)] lg:hidden"
      >
        <nav aria-label="Sections du site" className="contenu py-4">
          <ul className="m-0 list-none space-y-1 p-0">
            {LIENS.map((lien) => (
              <li key={lien.href}>
                <Link
                  href={lien.href}
                  onClick={() => setOuvert(false)}
                  className="flex min-h-[var(--spacing-cible)] items-center rounded-[var(--radius-champ)] px-3 font-medium text-[color:var(--color-encre)] no-underline hover:bg-[color:var(--color-survol)]"
                >
                  {lien.libelle}
                </Link>
              </li>
            ))}
          </ul>

          <Link
            href="/#decouvrir"
            onClick={() => setOuvert(false)}
            className="bouton bouton-rose mt-4 w-full"
          >
            Découvrir AvecStudy
          </Link>
        </nav>
      </div>
    </header>
  );
}
