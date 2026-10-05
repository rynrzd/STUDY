"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Lien de navigation qui sait s'il désigne la page courante.
 * `aria-current="page"` porte l'information ; le fond rose ne fait que
 * l'appuyer. `exact` : la racine d'un espace ne s'allume pas sur ses enfants.
 */
export function LienNavigation({
  href,
  exact = false,
  aussi = [],
  className,
  children,
  ...reste
}: {
  href: string;
  exact?: boolean;
  /** Autres préfixes qui rendent ce lien actif. */
  aussi?: readonly string[];
  className?: string;
  children: React.ReactNode;
} & Omit<React.AnchorHTMLAttributes<HTMLAnchorElement>, "href">) {
  const chemin = usePathname() ?? "";
  const correspond = (p: string) => chemin === p || chemin.startsWith(`${p}/`);
  const actif = exact ? chemin === href : correspond(href) || aussi.some(correspond);
  return (
    <Link href={href} className={className} aria-current={actif ? "page" : undefined} {...reste}>
      {children}
    </Link>
  );
}
