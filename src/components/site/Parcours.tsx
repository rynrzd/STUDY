"use client";

import { useEffect, useRef, useState } from "react";

/**
 * Trois parcours concrets — section 5 de la landing.
 *
 * Le cahier de finition autorise « une démonstration animée d'un seul parcours
 * produit ». Un seul panneau est donc animé à la fois : les étapes du parcours
 * choisi s'éclairent l'une après l'autre. L'animation s'arrête dès qu'une
 * personne interagit, et ne démarre pas du tout si elle a demandé la réduction
 * des mouvements.
 *
 * Les onglets suivent le motif ARIA attendu : flèches pour changer d'onglet,
 * Début et Fin pour aller aux extrémités.
 */

const PARCOURS = [
  {
    id: "seance",
    onglet: "Publier une séance",
    role: "Enseignant",
    resume:
      "Le cours de la journée est déposé dans la classe concernée, visible des élèves au moment choisi.",
    etapes: [
      "Ouvrir la classe et le chapitre en cours.",
      "Déposer le cours, les exercices et les documents de la séance.",
      "Choisir la publication : immédiate, ou à une date.",
      "Les élèves de cette classe — et eux seuls — voient la séance.",
    ],
  },
  {
    id: "devoir",
    onglet: "Remettre et corriger un devoir",
    role: "Élève, puis enseignant",
    resume:
      "Chaque copie est datée, conservée telle quelle, et le retour est rattaché à l'élève qui l'a rendue.",
    etapes: [
      "L'élève dépose sa copie avant l'échéance.",
      "La remise est horodatée ; la version déposée n'est plus modifiable.",
      "L'enseignant annote, note et rend son retour.",
      "L'élève retrouve la correction à côté de sa copie.",
    ],
  },
  {
    id: "import",
    onglet: "Importer les classes",
    role: "Administrateur d'établissement",
    resume:
      "Les classes, les élèves et les affectations sont créés depuis l'export de l'établissement.",
    etapes: [
      "Déposer le fichier .xlsx ou .csv de l'établissement.",
      "Vérifier l'aperçu et corriger les lignes signalées.",
      "Confirmer : classes, élèves, enseignants et affectations sont créés.",
      "Imprimer les identifiants et les mots de passe temporaires à distribuer.",
    ],
  },
] as const;

export function Parcours() {
  const [actif, setActif] = useState(0);
  const [etape, setEtape] = useState(0);
  const [arrete, setArrete] = useState(false);
  const boutons = useRef<(HTMLButtonElement | null)[]>([]);

  const parcours = PARCOURS[actif] ?? PARCOURS[0]!;

  // Un seul effet, et il ne pose aucun état de façon synchrone : il lit la
  // préférence de mouvement au montage et, si elle l'autorise, installe le
  // minuteur. Une interaction l'arrête définitivement.
  useEffect(() => {
    if (arrete) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;

    const minuteur = window.setInterval(() => {
      setEtape((precedente) => (precedente + 1) % parcours.etapes.length);
    }, 2200);

    return () => window.clearInterval(minuteur);
  }, [arrete, parcours.etapes.length]);

  function choisir(index: number) {
    setActif(index);
    setEtape(0);
    setArrete(true); // toute interaction arrête la démonstration
  }

  function auClavier(evenement: React.KeyboardEvent<HTMLButtonElement>, index: number) {
    const dernier = PARCOURS.length - 1;
    let cible: number | null = null;
    if (evenement.key === "ArrowRight") cible = index === dernier ? 0 : index + 1;
    if (evenement.key === "ArrowLeft") cible = index === 0 ? dernier : index - 1;
    if (evenement.key === "Home") cible = 0;
    if (evenement.key === "End") cible = dernier;
    if (cible === null) return;
    evenement.preventDefault();
    choisir(cible);
    boutons.current[cible]?.focus();
  }

  return (
    <div className="mt-12">
      <div
        role="tablist"
        aria-label="Parcours"
        className="flex flex-wrap gap-6 border-b border-[color:var(--color-bordure)]"
      >
        {PARCOURS.map((element, index) => (
          <button
            key={element.id}
            ref={(noeud) => {
              boutons.current[index] = noeud;
            }}
            type="button"
            role="tab"
            id={`onglet-${element.id}`}
            aria-selected={index === actif}
            aria-controls={`panneau-${element.id}`}
            tabIndex={index === actif ? 0 : -1}
            onClick={() => choisir(index)}
            onKeyDown={(evenement) => auClavier(evenement, index)}
            className="onglet"
          >
            {element.onglet}
          </button>
        ))}
      </div>

      <div
        role="tabpanel"
        id={`panneau-${parcours.id}`}
        aria-labelledby={`onglet-${parcours.id}`}
        tabIndex={0}
        className="grid gap-10 pt-10 md:grid-cols-[minmax(0,22rem)_minmax(0,1fr)]"
      >
        <div>
          <p className="surtitre m-0">{parcours.role}</p>
          <p className="mt-4 text-[length:var(--text-grand)] leading-[var(--text-grand--line-height)] text-[color:var(--color-encre-faible)]">
            {parcours.resume}
          </p>
        </div>

        <ol className="m-0 list-none space-y-0 p-0">
          {parcours.etapes.map((texte, index) => {
            const courante = index === etape;
            return (
              <li
                key={texte}
                className="flex gap-4 border-t border-[color:var(--color-bordure)] py-4 first:border-t-0 first:pt-0"
              >
                <span
                  aria-hidden="true"
                  className={`mt-0.5 flex size-7 shrink-0 items-center justify-center rounded-full border text-[0.8125rem] font-semibold transition-colors duration-300 ${
                    courante
                      ? "border-[color:var(--color-accent)] bg-[color:var(--color-accent)] text-white"
                      : "border-[color:var(--color-bordure-forte)] text-[color:var(--color-encre-faible)]"
                  }`}
                >
                  {index + 1}
                </span>
                <span
                  className={`transition-colors duration-300 ${
                    courante
                      ? "text-[color:var(--color-encre)]"
                      : "text-[color:var(--color-encre-faible)]"
                  }`}
                >
                  {texte}
                </span>
              </li>
            );
          })}
        </ol>
      </div>
    </div>
  );
}
