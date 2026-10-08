"use client";

import Link from "next/link";
import { useEffect, useRef } from "react";
import s from "./accueil.module.css";

/**
 * Menu public du téléphone — demandé par le README de la référence R2 (« le
 * menu public mobile complet reste à intégrer : focus, Échap, retour au
 * déclencheur »). Un `<details>` natif : il s'ouvre et se ferme sans script ;
 * avec script, Échap le ferme et rend le focus au bouton, et choisir un lien
 * le referme. Invisible sur bureau, où la navigation est déjà affichée.
 */
export function MenuMobile() {
  const menu = useRef<HTMLDetailsElement>(null);

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

  const fermer = () => {
    if (menu.current) menu.current.open = false;
  };

  return (
    <details ref={menu} className={s.menuMobile}>
      <summary aria-label="Menu">Menu</summary>
      <div className={s.menuPanneau}>
        <Link href="/produit" onClick={fermer}>
          La plateforme
        </Link>
        <Link href="/etablissements" onClick={fermer}>
          Établissements
        </Link>
        <Link className={s.button} href="/contact" onClick={fermer}>
          Demander une démo
        </Link>
      </div>
    </details>
  );
}
