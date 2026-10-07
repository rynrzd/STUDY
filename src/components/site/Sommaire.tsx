"use client";

import { useEffect, useState } from "react";

/**
 * Sommaire des pages éditoriales (cahier §05 : « gabarit éditorial 760 px,
 * sommaire »). Il relève les titres de section du contenu principal, leur
 * donne une ancre stable, et les liste. Sans script, il n'apparaît pas et la
 * page reste complète : c'est une aide de navigation, pas un contenu.
 */
export function Sommaire() {
  const [entrees, setEntrees] = useState<{ id: string; texte: string }[]>([]);

  useEffect(() => {
    const vus = new Set<string>();
    const titres = [...document.querySelectorAll<HTMLHeadingElement>("#contenu h2")].filter((h) => !h.closest("[data-sans-sommaire]"));
    const liste = titres.map((h) => {
      const texte = (h.textContent ?? "").trim();
      let id = h.id;
      if (!id) {
        const base = texte
          .toLowerCase()
          .normalize("NFD")
          .replace(/[̀-ͯ]/g, "")
          .replace(/[^a-z0-9]+/g, "-")
          .replace(/^-|-$/g, "")
          .slice(0, 48) || "section";
        id = base;
        for (let n = 2; vus.has(id) || document.getElementById(id); n += 1) id = `${base}-${n}`;
        h.id = id;
      }
      vus.add(id);
      h.style.scrollMarginTop = "96px";
      return { id, texte };
    });
    const image = requestAnimationFrame(() => setEntrees(liste));
    return () => cancelAnimationFrame(image);
  }, []);

  if (entrees.length < 2) return null;
  return (
    <nav aria-label="Sommaire" data-sans-sommaire className="mb-10 max-w-[760px] rounded-[var(--radius-carte)] border border-[color:var(--color-bordure)] bg-[color:var(--color-surface)] p-5">
      <p className="m-0 text-[0.8125rem] font-bold uppercase tracking-[0.1em] text-[color:var(--color-encre-faible)]">Sommaire</p>
      <ol className="m-0 mt-2 grid list-decimal gap-0.5 pl-5 sm:grid-cols-2 sm:gap-x-8">
        {entrees.map((e) => (
          <li key={e.id} className="text-[0.9375rem] marker:text-[color:var(--color-encre-faible)]">
            <a href={`#${e.id}`} className="inline-flex min-h-[40px] items-center font-semibold text-[color:var(--color-encre)] no-underline hover:text-[color:var(--color-accent)]">
              {e.texte}
            </a>
          </li>
        ))}
      </ol>
    </nav>
  );
}
