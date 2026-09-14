"use client";

import { useId, useRef, useState } from "react";

/**
 * Section « trois situations » — ch. 04, chorégraphie ch. 34.
 *
 * Contraintes tenues ici :
 *  - le changement d'onglet fonctionne au clavier (motif ARIA « tabs ») ;
 *  - il ne dépend d'aucune animation : le fondu est décoratif, 220 ms ;
 *  - aucun carrousel automatique — rien ne change sans une action.
 *
 * Les trois panneaux sont rendus côté serveur ; seul l'affichage bascule.
 */

interface Situation {
  readonly id: string;
  readonly libelle: string;
  readonly phrases: readonly [string, string, string];
  readonly apercu: React.ReactNode;
  readonly legende: string;
}

const CADRE =
  "overflow-hidden rounded-[var(--radius-carte)] border border-[color:var(--color-bordure)] " +
  "bg-[color:var(--color-surface)] shadow-[var(--shadow-carte)] p-4 " +
  "text-[length:var(--text-aide)] leading-[var(--text-aide--line-height)]";

function ApercuOrdinateur() {
  return (
    <div className={CADRE}>
      <p className="m-0 text-[color:var(--color-encre-faible)]">Seconde 1 · Mathématiques</p>
      <div className="mt-3 grid gap-3 sm:grid-cols-2">
        <div className="rounded-[var(--radius-champ)] border border-[color:var(--color-bordure)] p-3">
          <p className="m-0 font-semibold">Le cours</p>
          <p className="mt-2 m-0 text-[color:var(--color-encre-faible)]">
            Une fonction affine est une fonction de la forme f(x) = ax + b.
          </p>
        </div>
        <div className="rounded-[var(--radius-champ)] border border-[color:var(--color-bordure)] bg-[color:var(--color-fond)] p-3">
          <p className="m-0 font-semibold">Ma réponse</p>
          <p className="mt-2 m-0 text-[color:var(--color-encre-faible)]">
            f(2) = 3 × 2 − 4 = 2
          </p>
          <p className="mt-3 m-0 text-[color:var(--color-encre-faible)]">Enregistré · 10 h 24</p>
        </div>
      </div>
      <p className="mt-3 m-0 text-[color:var(--color-encre-faible)]">
        « Enregistré » ne veut pas dire « remis ».
      </p>
    </div>
  );
}

function ApercuPapier() {
  return (
    <div className={CADRE}>
      <p className="m-0 text-[color:var(--color-encre-faible)]">Mode projection</p>
      <div className="mt-3 rounded-[var(--radius-champ)] border border-[color:var(--color-bordure)] p-4">
        <p className="m-0 font-semibold">Séance 4 — Résoudre un problème</p>
        <p className="mt-2 m-0 text-[color:var(--color-encre-faible)]">
          Modéliser une situation à l&apos;aide d&apos;une fonction affine.
        </p>
      </div>
      <ul className="mt-3 m-0 list-none space-y-1 p-0 text-[color:var(--color-encre-faible)]">
        <li>Noms masqués</li>
        <li>Copies masquées</li>
        <li>Notifications masquées</li>
      </ul>
      <p className="mt-3 m-0 text-[color:var(--color-encre-faible)]">
        Rien d&apos;individuel ne peut être projeté par accident.
      </p>
    </div>
  );
}

function ApercuMaison() {
  return (
    <div className={`${CADRE} max-w-[280px]`}>
      <p className="m-0 text-[color:var(--color-encre-faible)]">Ma copie</p>
      <p className="m-0 font-semibold">Exercice 3 — Fonctions affines</p>
      <div className="mt-3 flex items-center gap-3 rounded-[var(--radius-champ)] border border-[color:var(--color-bordure)] p-2">
        <span
          className="inline-flex h-8 w-8 items-center justify-center rounded-[6px] bg-[color:var(--color-rose-selection)] text-[11px]"
          aria-hidden="true"
        >
          jpg
        </span>
        <span className="min-w-0">
          <span className="block truncate">Cahier.jpg</span>
          <span className="block text-[color:var(--color-encre-faible)]">1,2 Mo</span>
        </span>
      </div>
      <div className="mt-3 inline-flex min-h-[36px] w-full items-center justify-center rounded-[var(--radius-champ)] bg-[color:var(--color-encre)] px-4 text-[color:var(--color-surface)]">
        Rendre mon devoir
      </div>
      <p className="mt-3 m-0 text-[color:var(--color-encre-faible)]">
        Modifiable jusqu&apos;à la date limite.
      </p>
    </div>
  );
}

const SITUATIONS: readonly Situation[] = [
  {
    id: "salle-informatique",
    libelle: "En salle informatique",
    phrases: [
      "Le cours à gauche, la réponse de l'élève à droite, sur le même écran.",
      "Chaque copie reste personnelle, même quand deux élèves partagent un poste.",
      "La remise est enregistrée par le serveur, avec sa date et sa version.",
    ],
    apercu: <ApercuOrdinateur />,
    legende: "séance ouverte sur un poste de salle informatique",
  },
  {
    id: "classe-papier",
    libelle: "En classe sur papier",
    phrases: [
      "Le professeur projette le cours sans afficher les noms ni les copies.",
      "Le support s'imprime ; les élèves écrivent dans leur cahier.",
      "La remise physique est cochée par le professeur, sans photo obligatoire.",
    ],
    apercu: <ApercuPapier />,
    legende: "mode projection, sans donnée individuelle à l'écran",
  },
  {
    id: "maison",
    libelle: "À la maison",
    phrases: [
      "L'élève retrouve la séance faite en classe, et ce qu'il faut préparer.",
      "Une photo du cahier suffit à rendre un devoir.",
      "La correction arrive quand le professeur décide de la publier.",
    ],
    apercu: <ApercuMaison />,
    legende: "remise d'un devoir depuis un téléphone",
  },
];

export function Situations() {
  const [actif, setActif] = useState(0);
  const base = useId();
  const references = useRef<(HTMLButtonElement | null)[]>([]);

  function deplacer(vers: number) {
    const index = (vers + SITUATIONS.length) % SITUATIONS.length;
    setActif(index);
    references.current[index]?.focus();
  }

  function auClavier(evenement: React.KeyboardEvent<HTMLButtonElement>, index: number) {
    switch (evenement.key) {
      case "ArrowRight":
        evenement.preventDefault();
        deplacer(index + 1);
        break;
      case "ArrowLeft":
        evenement.preventDefault();
        deplacer(index - 1);
        break;
      case "Home":
        evenement.preventDefault();
        deplacer(0);
        break;
      case "End":
        evenement.preventDefault();
        deplacer(SITUATIONS.length - 1);
        break;
      default:
        break;
    }
  }

  const situation = SITUATIONS[actif]!;

  return (
    <section aria-labelledby={`${base}-titre`} className="py-16 md:py-24">
      <h2
        id={`${base}-titre`}
        className="text-center text-[length:var(--text-h1-app)] leading-[var(--text-h1-app--line-height)]"
      >
        En cours. À la maison. Toujours la même classe.
      </h2>

      <div
        role="tablist"
        aria-label="Situations d'usage"
        className="mt-8 flex flex-wrap justify-center gap-6 border-b border-[color:var(--color-bordure)]"
      >
        {SITUATIONS.map((element, index) => {
          const selectionne = index === actif;
          return (
            <button
              key={element.id}
              ref={(noeud) => {
                references.current[index] = noeud;
              }}
              type="button"
              role="tab"
              id={`${base}-onglet-${element.id}`}
              aria-selected={selectionne}
              aria-controls={`${base}-panneau-${element.id}`}
              tabIndex={selectionne ? 0 : -1}
              onClick={() => setActif(index)}
              onKeyDown={(evenement) => auClavier(evenement, index)}
              className={`onglet-souligne min-h-[var(--spacing-cible)] px-1 pb-3 ${
                selectionne ? "font-semibold" : "text-[color:var(--color-encre-faible)]"
              }`}
            >
              {element.libelle}
            </button>
          );
        })}
      </div>

      <div
        role="tabpanel"
        id={`${base}-panneau-${situation.id}`}
        aria-labelledby={`${base}-onglet-${situation.id}`}
        tabIndex={0}
        className="mt-10 grid items-center gap-10 md:grid-cols-2"
      >
        <ul className="m-0 list-none space-y-4 p-0">
          {situation.phrases.map((phrase) => (
            <li key={phrase} className="flex gap-3">
              <span
                aria-hidden="true"
                className="mt-2.5 h-1.5 w-1.5 shrink-0 rounded-full bg-[color:var(--color-rose-decor)]"
              />
              <span>{phrase}</span>
            </li>
          ))}
        </ul>

        <figure key={situation.id} className="apercu-fondu m-0 flex flex-col items-center">
          {situation.apercu}
          <figcaption className="mt-3 self-start text-[length:var(--text-aide)] leading-[var(--text-aide--line-height)] text-[color:var(--color-encre-faible)]">
            Aperçu de l&apos;interface en construction — {situation.legende}. Maquette,
            pas une capture.
          </figcaption>
        </figure>
      </div>
    </section>
  );
}
