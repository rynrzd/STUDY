"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/**
 * Lien de navigation d'espace, qui sait s'il est la page courante.
 *
 * `aria-current="page"` n'est pas décoratif : c'est ce qui indique la position
 * à un lecteur d'écran, et c'est aussi ce que la feuille de style utilise pour
 * le fond rose. L'information ne passe donc jamais par la seule couleur.
 */
export function LienNav({ href, children }: { href: string; children: React.ReactNode }) {
  const chemin = usePathname();

  // Une section est active quand on est sur elle ou dans une de ses pages.
  // La racine d'espace ne s'active pas sur ses enfants, sinon deux onglets
  // seraient marqués courants en même temps.
  const racine = href.split("/").length <= 2;
  const actif = racine ? chemin === href : chemin === href || chemin.startsWith(`${href}/`);

  return (
    <Link href={href} className="lien-nav" aria-current={actif ? "page" : undefined}>
      {children}
    </Link>
  );
}
