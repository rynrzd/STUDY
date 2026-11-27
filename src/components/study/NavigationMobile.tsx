"use client";

import { usePathname } from "next/navigation";
import { MoreHorizontal } from "lucide-react";
import { useEffect, useRef, useState, type CSSProperties, type MouseEvent, type ReactNode } from "react";
import { indexNavigationMobile, type CibleNavigationMobile } from "@/lib/navigation-mobile";

/** Capsule liquide : la courbe en U et l'icône flottante partagent la même position animée. */
export function NavigationMobile({
  principales,
  autres,
  icones,
  children,
}: {
  principales: readonly CibleNavigationMobile[];
  autres: readonly CibleNavigationMobile[];
  icones: readonly ReactNode[];
  children: ReactNode;
}) {
  const chemin = usePathname() ?? "";
  const actif = indexNavigationMobile(chemin, principales, autres);
  const [intention, definirIntention] = useState<{ chemin: string; index: number } | null>(null);
  const minuteur = useRef<ReturnType<typeof setTimeout> | null>(null);
  // Le clic commence l'animation immédiatement, même sur une liaison lente.
  // Le chemin réellement chargé reprend toujours la main ; une navigation
  // interrompue restaure l'onglet courant au bout de deux secondes.
  const position = intention?.chemin === chemin ? intention.index : actif;

  useEffect(() => () => {
    if (minuteur.current) clearTimeout(minuteur.current);
  }, []);

  const toucherDestination = (evenement: MouseEvent<HTMLElement>) => {
    const origine = evenement.target;
    if (!(origine instanceof Element)) return;
    const lien = origine.closest("a[data-onglet-index]");
    if (!(lien instanceof HTMLAnchorElement) || !evenement.currentTarget.contains(lien)) return;
    if (evenement.metaKey || evenement.ctrlKey || evenement.shiftKey || evenement.altKey) return;
    const index = Number(lien.dataset.ongletIndex);
    if (!Number.isInteger(index) || index < 0 || index > 3) return;
    if (minuteur.current) clearTimeout(minuteur.current);
    definirIntention({ chemin, index });
    minuteur.current = setTimeout(() => {
      definirIntention(null);
      minuteur.current = null;
    }, 2000);
  };

  return (
    <nav
      className="app-nav-mobile app-nav-mobile-animee"
      aria-label="Destinations"
      style={{ "--onglet-position": `${(position >= 0 ? position : 0) * 20 + 10}%` } as CSSProperties}
      data-selection={position >= 0 ? "oui" : "non"}
      data-onglet-visuel={position}
      onClickCapture={toucherDestination}
    >
      <span className="app-nav-mobile-bulle" aria-hidden="true">
        <span className="app-nav-mobile-bulle-icone" key={position}>
          {position === 4 ? <MoreHorizontal size={23} strokeWidth={1.85} /> : icones[position] ?? null}
        </span>
        <span className="app-nav-mobile-bulle-plus"><MoreHorizontal size={23} strokeWidth={1.85} /></span>
      </span>
      {children}
    </nav>
  );
}
