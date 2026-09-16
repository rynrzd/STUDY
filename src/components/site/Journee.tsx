"use client";

import { useEffect, useRef, useState } from "react";

/**
 * « Une journée avec AvecStudy » — cahier V2, §4.4.
 *
 * Quatre moments, racontés au défilement. Le repère horaire avance à mesure
 * que la page descend : c'est la narration demandée, sans parallaxe ni effet
 * qui ralentirait un téléphone.
 *
 * Sans JavaScript, ou en mouvement réduit, les quatre moments sont simplement
 * empilés et tous lisibles : on perd le suivi, pas le contenu.
 */

const MOMENTS = [
  {
    heure: "08:05",
    titre: "Le professeur prépare sa séance",
    texte:
      "Dans le Studio, il ouvre le chapitre en cours, crée la séance du jour et y dépose le plan, la fiche d'exercices et le devoir. Quinze minutes avant la sonnerie.",
  },
  {
    heure: "10:00",
    titre: "Le cours commence",
    texte:
      "La séance est projetée au tableau. Les élèves travaillent sur papier ou sur ordinateur, comme d'habitude : rien ne change dans la façon de faire cours.",
  },
  {
    heure: "10:55",
    titre: "Les ressources restent attachées à la séance",
    texte:
      "La fiche distribuée n'est pas perdue dans un dossier partagé : elle appartient à cette séance, dans ce chapitre, pour cette classe.",
  },
  {
    heure: "17:30",
    titre: "L'élève retrouve le cours et le travail à faire",
    texte:
      "Il ouvre AvecStudy, voit la séance du jour et le devoir à rendre. Il n'a rien à chercher : c'est rangé à l'endroit où le cours a eu lieu.",
  },
] as const;

export function Journee() {
  const [actif, setActif] = useState(0);
  const moments = useRef<(HTMLLIElement | null)[]>([]);

  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const observateur = new IntersectionObserver(
      (entrees) => {
        for (const entree of entrees) {
          if (!entree.isIntersecting) continue;
          const index = moments.current.indexOf(entree.target as HTMLLIElement);
          if (index >= 0) setActif(index);
        }
      },
      // La bande de déclenchement est au tiers haut de l'écran : le moment
      // devient actif quand on arrive dessus, pas quand il a déjà défilé.
      { rootMargin: "-30% 0px -55% 0px", threshold: 0 },
    );

    for (const element of moments.current) {
      if (element !== null) observateur.observe(element);
    }
    return () => observateur.disconnect();
  }, []);

  return (
    <ol className="m-0 list-none p-0">
      {MOMENTS.map((moment, index) => (
        <li
          key={moment.heure}
          ref={(noeud) => {
            moments.current[index] = noeud;
          }}
          className="relative grid grid-cols-[64px_minmax(0,1fr)] gap-5 pb-12 last:pb-0 sm:grid-cols-[96px_minmax(0,1fr)] sm:gap-8"
        >
          {/* Le filet vertical relie les moments entre eux. */}
          <span
            aria-hidden="true"
            className="absolute left-[7px] top-3 h-full w-px bg-[color:var(--color-bordure)] sm:left-[11px]"
          />

          <div className="relative">
            <span
              aria-hidden="true"
              className={`absolute left-0 top-2 block size-[15px] rounded-full border-2 transition-colors duration-300 sm:size-[23px] ${
                index <= actif
                  ? "border-[color:var(--color-accent)] bg-[color:var(--color-accent)]"
                  : "border-[color:var(--color-bordure-forte)] bg-[color:var(--color-surface)]"
              }`}
            />
            <span
              className={`ml-6 block font-mono text-[length:var(--text-tableau)] font-semibold transition-colors duration-300 sm:ml-9 ${
                index <= actif
                  ? "text-[color:var(--color-accent)]"
                  : "text-[color:var(--color-encre-tres-faible)]"
              }`}
            >
              {moment.heure}
            </span>
          </div>

          <div
            className={`transition-opacity duration-300 ${
              index <= actif ? "opacity-100" : "opacity-60"
            }`}
          >
            <h3 className="text-[length:var(--text-h3)] leading-[var(--text-h3--line-height)]">
              {moment.titre}
            </h3>
            <p className="m-0 mt-2 max-w-[54ch] text-[color:var(--color-encre-faible)]">
              {moment.texte}
            </p>
          </div>
        </li>
      ))}
    </ol>
  );
}
