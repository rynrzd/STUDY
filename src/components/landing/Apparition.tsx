"use client";

import { useEffect, useRef } from "react";

/**
 * Entrée d'une section au défilement — chapitre 34 (20 px, 550 ms, une fois).
 *
 * Le point délicat est la dégradation : le cahier des charges exige que le
 * texte soit présent dans le HTML rendu serveur **et visible si JavaScript
 * échoue**. On ne peut donc pas masquer les sections en CSS statique.
 *
 * D'où ce fonctionnement : le serveur rend la section telle quelle, visible.
 * C'est seulement après montage, et seulement si IntersectionObserver existe
 * et que la personne n'a pas demandé de réduction des mouvements, que le
 * composant pose lui-même l'état masqué puis déclenche l'entrée. Sans
 * JavaScript, sans observer, ou en mouvement réduit, rien ne se passe et la
 * section reste lisible.
 */
export function Apparition({
  children,
  delai = 0,
  className,
}: {
  children: React.ReactNode;
  /** Décalage en millisecondes, pour faire entrer texte et image en décalé. */
  delai?: number;
  className?: string;
}) {
  const noeud = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const element = noeud.current;
    if (element === null) return;
    if (typeof IntersectionObserver === "undefined") return;

    const mouvementReduit = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (mouvementReduit) return;

    // Déjà dans l'écran au montage : ne pas la masquer pour la refaire entrer,
    // cela produirait un clignotement au chargement.
    const rect = element.getBoundingClientRect();
    if (rect.top < window.innerHeight * 0.9) return;

    element.dataset.apparition = "prete";

    const observateur = new IntersectionObserver(
      (entrees) => {
        for (const entree of entrees) {
          if (!entree.isIntersecting) continue;
          element.dataset.apparition = "visible";
          // « Une fois seulement » (ch. 34) : on cesse d'observer aussitôt.
          observateur.disconnect();
        }
      },
      { rootMargin: "0px 0px -10% 0px", threshold: 0.1 },
    );

    observateur.observe(element);
    return () => observateur.disconnect();
  }, []);

  return (
    <div ref={noeud} className={className} style={{ "--delai": `${delai}ms` } as React.CSSProperties}>
      {children}
    </div>
  );
}
