"use client";

import { useEffect, useRef } from "react";

/**
 * Apparition au défilement — 250 à 450 ms, léger décalage vertical.
 *
 * Le contenu est rendu côté serveur et **visible** : l'état masqué n'est posé
 * qu'après montage, et seulement si l'observateur existe et que la personne
 * n'a pas demandé de réduction des mouvements. Sans JavaScript, la page reste
 * entièrement lisible — l'effet disparaît, pas le contenu.
 *
 * Un élément déjà à l'écran au montage n'est pas masqué puis révélé : cela
 * produirait un clignotement au chargement.
 */
export function Reveler({
  children,
  delai = 0,
  className,
  as: Balise = "div",
}: {
  children: React.ReactNode;
  delai?: number;
  className?: string;
  as?: "div" | "section" | "li" | "article";
}) {
  const noeud = useRef<HTMLDivElement>(null);
  // `Balise` est une union de balises ; TypeScript exige alors une ref
  // compatible avec toutes à la fois, ce qui n'existe pas. On fixe le type au
  // moment du rendu : les quatre balises acceptées sont des HTMLElement, et
  // seule `getBoundingClientRect` et `dataset` sont utilisées.
  const Element = Balise as "div";

  useEffect(() => {
    const element = noeud.current;
    if (element === null) return;
    if (typeof IntersectionObserver === "undefined") return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    if (element.getBoundingClientRect().top < window.innerHeight * 0.92) return;

    element.dataset.revele = "prete";

    const observateur = new IntersectionObserver(
      (entrees) => {
        for (const entree of entrees) {
          if (!entree.isIntersecting) continue;
          element.dataset.revele = "visible";
          observateur.disconnect();
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.08 },
    );

    observateur.observe(element);
    return () => observateur.disconnect();
  }, []);

  return (
    <Element
      ref={noeud}
      className={className}
      style={{ "--delai": `${delai}ms` } as React.CSSProperties}
    >
      {children}
    </Element>
  );
}
