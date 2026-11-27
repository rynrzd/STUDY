"use client";

import { usePathname } from "next/navigation";
import { MoreHorizontal } from "lucide-react";
import { type CSSProperties, type ReactNode } from "react";

export interface CibleNavigationMobile {
  readonly href: string;
  readonly exact?: boolean;
  readonly aussi?: readonly string[];
}

/** Les chemins secondaires restent associés à leur onglet principal. */
export function destinationActive(chemin: string, cible: CibleNavigationMobile): boolean {
  if (cible.exact) return chemin === cible.href;
  return [cible.href, ...(cible.aussi ?? [])].some((p) => chemin === p || chemin.startsWith(`${p}/`));
}

export function indexNavigationMobile(
  chemin: string,
  principales: readonly CibleNavigationMobile[],
  autres: readonly CibleNavigationMobile[],
): number {
  const principale = principales.findIndex((cible) => destinationActive(chemin, cible));
  if (principale >= 0) return principale;
  return autres.some((cible) => destinationActive(chemin, cible)) ? 4 : -1;
}

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
  const position = indexNavigationMobile(chemin, principales, autres);

  return (
    <nav
      className="app-nav-mobile app-nav-mobile-animee"
      aria-label="Destinations"
      style={{ "--onglet-position": `${(position >= 0 ? position : 0) * 20 + 10}%` } as CSSProperties}
      data-selection={position >= 0 ? "oui" : "non"}
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
