"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** Onglets de Ma classe : la page courante porte aria-current. */
export function OngletsClasse({
  classe,
  libelle,
  delegues,
  gestion,
}: {
  classe: string;
  libelle: string;
  delegues: boolean;
  gestion: boolean;
}) {
  const chemin = usePathname() ?? "";
  const base = `/app/classes/${classe}`;
  const onglets = [
    { href: base, libelle: "Vie de classe", exact: true },
    { href: `${base}/propositions`, libelle: "Propositions et suivi" },
    { href: `${base}/salons`, libelle: "Messagerie" },
    { href: `${base}/bibliotheque`, libelle: "Bibliothèque" },
    { href: `${base}/membres`, libelle: gestion ? "Membres et accès" : "Membres" },
    ...(delegues ? [{ href: `${base}/delegues`, libelle: "Bureau des délégués" }] : []),
  ];
  return (
    <div className="mb-6">
      <p className="sourcil">Ma classe</p>
      <h1 className="titre-page mb-4">{libelle}</h1>
      <nav className="onglets-liens" aria-label="Sections de la classe">
        {onglets.map((o) => {
          const actif = o.exact ? chemin === o.href : chemin === o.href || chemin.startsWith(`${o.href}/`);
          return (
            <Link key={o.href} href={o.href} aria-current={actif ? "page" : undefined}>
              {o.libelle}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}
