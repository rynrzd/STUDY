"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { MoreHorizontal } from "lucide-react";
import { useEffect, useRef } from "react";

/**
 * « Plus » de la navigation mobile : les destinations qui ne tiennent pas
 * dans les quatre premières places. Un `<details>` natif : il s'ouvre et se
 * ferme sans script ; avec script, Échap le ferme et rend le focus, et un
 * changement de page le referme.
 */
export function MenuPlus({
  liens,
  espaces,
}: {
  liens: readonly { href: string; libelle: string; aussi: readonly string[]; exact: boolean }[];
  espaces: readonly { href: string; libelle: string; actif: boolean }[];
}) {
  const chemin = usePathname() ?? "";
  const menu = useRef<HTMLDetailsElement>(null);
  const actif = (l: { href: string; aussi: readonly string[]; exact: boolean }) =>
    l.exact ? chemin === l.href : [l.href, ...l.aussi].some((p) => chemin === p || chemin.startsWith(`${p}/`));
  const unActif = liens.some(actif);

  useEffect(() => {
    if (menu.current) menu.current.open = false;
  }, [chemin]);

  useEffect(() => {
    const d = menu.current;
    if (!d) return;
    const clavier = (e: KeyboardEvent) => {
      if (e.key === "Escape" && d.open) {
        d.open = false;
        d.querySelector("summary")?.focus();
      }
    };
    document.addEventListener("keydown", clavier);
    return () => document.removeEventListener("keydown", clavier);
  }, []);

  return (
    <details ref={menu} data-actif={unActif ? "oui" : "non"}>
      <summary aria-label="Plus de destinations">
        <MoreHorizontal size={22} strokeWidth={1.75} aria-hidden="true" />
        <span aria-hidden="true">Plus</span>
      </summary>
      <div className="app-plus-panneau">
        {espaces.length > 0 ? (
          <div className="mb-1 grid gap-1 border-b border-[color:var(--color-bordure)] pb-2">
            {espaces.map((e) => (
              <Link key={e.href} href={e.href} aria-current={e.actif ? "true" : undefined} className="lien-barre">
                {e.libelle}
              </Link>
            ))}
          </div>
        ) : null}
        {liens.map((l) => (
          <Link key={l.href} href={l.href} aria-current={actif(l) ? "page" : undefined} className="lien-barre">
            {l.libelle}
          </Link>
        ))}
      </div>
    </details>
  );
}
