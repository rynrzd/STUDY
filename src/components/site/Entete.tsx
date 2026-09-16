"use client";

import Link from "next/link";
import { useEffect, useId, useState } from "react";
import { MARQUE } from "@/lib/identite-legale";

/**
 * Navigation du site public.
 *
 * Structure imposée par la section 4 du cahier de finition : logo, Produit,
 * Pour les établissements, Sécurité, Offre, Connexion, puis le bouton de
 * demande de démonstration.
 *
 * L'en-tête change discrètement au défilement — une bordure et un fond un peu
 * plus opaques, rien de plus. Sur mobile, le menu est un panneau accessible,
 * fermé à l'échappement et au changement de page, et la connexion reste
 * atteignable sans l'ouvrir.
 */

const LIENS = [
  { href: "/produit", libelle: "Produit" },
  { href: "/etablissements", libelle: "Pour les établissements" },
  { href: "/securite", libelle: "Sécurité" },
  { href: "/offre", libelle: "Offre" },
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
      <div className="contenu flex h-[68px] items-center justify-between gap-6">
        <Link
          href="/"
          onClick={() => setOuvert(false)}
          className="text-[1.3125rem] font-extrabold tracking-[-0.03em] text-[color:var(--color-encre)] no-underline"
        >
          {MARQUE}
        </Link>

        <nav aria-label="Navigation principale" className="hidden lg:block">
          <ul className="m-0 flex list-none items-center gap-8 p-0">
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
          <Link href="/connexion" className="bouton bouton-discret hidden sm:inline-flex">
            Connexion
          </Link>
          <Link href="/etablissements" className="bouton bouton-primaire hidden sm:inline-flex">
            Demander une démo
          </Link>

          <button
            type="button"
            aria-expanded={ouvert}
            aria-controls={`${base}-menu`}
            aria-label={ouvert ? "Fermer le menu" : "Ouvrir le menu"}
            onClick={() => setOuvert(!ouvert)}
            className="bouton bouton-secondaire px-3 lg:hidden"
          >
            <span aria-hidden="true" className="flex flex-col gap-[5px]">
              <span className="block h-[2px] w-[18px] bg-current" />
              <span className="block h-[2px] w-[18px] bg-current" />
            </span>
            <span className="text-[length:var(--text-tableau)]">Menu</span>
          </button>
        </div>
      </div>

      <div
        id={`${base}-menu`}
        hidden={!ouvert}
        className="border-t border-[color:var(--color-bordure)] bg-[color:var(--color-surface)] lg:hidden"
      >
        <nav aria-label="Navigation" className="contenu py-4">
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

          <div className="mt-4 flex flex-col gap-2 border-t border-[color:var(--color-bordure)] pt-4">
            <Link
              href="/connexion"
              onClick={() => setOuvert(false)}
              className="bouton bouton-secondaire w-full"
            >
              Connexion
            </Link>
            <Link
              href="/etablissements"
              onClick={() => setOuvert(false)}
              className="bouton bouton-primaire w-full"
            >
              Demander une démo
            </Link>
          </div>
        </nav>
      </div>
    </header>
  );
}
