"use client";

import { usePathname } from "next/navigation";
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

/** La bulle suit la route active, même lors d'un retour arrière du navigateur. */
export function NavigationMobile({
  principales,
  autres,
  children,
}: {
  principales: readonly CibleNavigationMobile[];
  autres: readonly CibleNavigationMobile[];
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
      <span className="app-nav-mobile-bulle" aria-hidden="true" />
      {children}
    </nav>
  );
}
