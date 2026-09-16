"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";

/**
 * Aperçu du Studio — pièce maîtresse de la landing (cahier V2, §4.2 et §4.3).
 *
 * Ce n'est pas une illustration abstraite : c'est la structure exacte du
 * Studio — colonne des chapitres à gauche, séance au centre, blocs empilés —
 * jouée comme une petite démonstration. Le cahier demande de montrer une vraie
 * représentation de l'interface, et d'y faire voir la préparation d'une
 * séance : ajout d'un document, ajout d'un devoir, passage en publié, puis
 * aperçu côté élève.
 *
 * Deux règles tenues :
 *
 *  - **Rien n'est cliquable.** Ce n'est pas une fausse application : les
 *    éléments sont inertes et l'ensemble est masqué aux lecteurs d'écran, qui
 *    reçoivent à la place un résumé textuel.
 *  - **Aucune donnée inventée n'est présentée comme un chiffre du produit.**
 *    Les noms de classes et de chapitres sont des exemples, annoncés comme
 *    tels sous l'aperçu.
 *
 * En mouvement réduit, la séquence n'est pas jouée : l'état final s'affiche
 * directement, complet et lisible.
 */

/** Les étapes de la démonstration, dans l'ordre du cahier §4.3. */
const ETAPES = [
  { cle: "vide", libelle: "Le professeur ouvre son chapitre" },
  { cle: "titre", libelle: "Il crée la séance du jour" },
  { cle: "texte", libelle: "Il écrit le plan du cours" },
  { cle: "document", libelle: "Il joint la fiche d'exercices" },
  { cle: "devoir", libelle: "Il ajoute le devoir et son échéance" },
  { cle: "publie", libelle: "Il publie : la classe y a accès" },
  { cle: "eleve", libelle: "L'élève retrouve la séance le soir" },
] as const;

type Cle = (typeof ETAPES)[number]["cle"];

const RANG: Record<Cle, number> = {
  vide: 0, titre: 1, texte: 2, document: 3, devoir: 4, publie: 5, eleve: 6,
};

/**
 * Le reglage systeme « animations reduites », lu comme ce qu'il est : un etat
 * exterieur a React. `useSyncExternalStore` evite de le recopier dans un etat
 * local depuis un effet — ce qui provoquerait un rendu en cascade — et suit les
 * changements si la personne modifie le reglage pendant sa visite.
 */
function useMouvementReduit(): boolean {
  return useSyncExternalStore(
    (rappel) => {
      const requete = window.matchMedia("(prefers-reduced-motion: reduce)");
      requete.addEventListener("change", rappel);
      return () => requete.removeEventListener("change", rappel);
    },
    () => window.matchMedia("(prefers-reduced-motion: reduce)").matches,
    // Au rendu serveur, rien ne bouge encore : l'apercu part de son etat
    // initial, et le client corrige a l'hydratation s'il le faut.
    () => false,
  );
}

export function ApercuStudio({ anime = true }: { anime?: boolean }) {
  const [etapeAnimee, setEtape] = useState<Cle>("vide");
  const reduit = useMouvementReduit();
  const [enMarche, setEnMarche] = useState(false);
  const cadre = useRef<HTMLDivElement>(null);

  // La séquence ne démarre qu'une fois l'aperçu à l'écran : la jouer dans le
  // vide ferait manquer la démonstration à qui arrive en cours de page.
  useEffect(() => {
    if (!anime || reduit) return;

    const element = cadre.current;
    if (element === null) return;

    const observateur = new IntersectionObserver(
      (entrees) => {
        for (const entree of entrees) {
          if (entree.isIntersecting) {
            setEnMarche(true);
            observateur.disconnect();
          }
        }
      },
      { threshold: 0.35 },
    );

    observateur.observe(element);
    return () => observateur.disconnect();
  }, [anime, reduit]);

  useEffect(() => {
    if (!enMarche) return;

    const minuteur = window.setInterval(() => {
      setEtape((precedente) => {
        const suivante = RANG[precedente] + 1;
        return suivante >= ETAPES.length ? "eleve" : ETAPES[suivante]!.cle;
      });
    }, 1700);

    return () => window.clearInterval(minuteur);
  }, [enMarche]);

  // Sans animation — section statique, ou mouvement reduit — l'apercu montre
  // directement l'etat final : la seance publiee, vue par l'eleve. C'est
  // l'image qui porte le message, pas la sequence.
  const etape: Cle = anime && !reduit ? etapeAnimee : "eleve";
  const rang = RANG[etape];
  const cotEleve = etape === "eleve";

  return (
    <div ref={cadre}>
      <div
        aria-hidden="true"
        className="overflow-hidden rounded-[var(--radius-carte)] border border-[color:var(--color-bordure)] bg-[color:var(--color-surface)] shadow-[var(--shadow-flottant)]"
      >
        <BarreFenetre cotEleve={cotEleve} />

        <div className="grid min-h-[310px] grid-cols-[132px_minmax(0,1fr)] sm:min-h-[360px] sm:grid-cols-[188px_minmax(0,1fr)]">
          <Colonne cotEleve={cotEleve} rang={rang} />
          <Seance etape={etape} rang={rang} cotEleve={cotEleve} />
        </div>
      </div>

      {/* Le résumé textuel remplace l'aperçu pour un lecteur d'écran, et sert
          de légende pour tout le monde. */}
      <p
        className="mt-4 text-[length:var(--text-aide)] leading-[var(--text-aide--line-height)] text-[color:var(--color-encre-faible)]"
        aria-live="off"
      >
        {anime ? (
          <>
            <span className="font-medium text-[color:var(--color-encre)]">
              {ETAPES[rang]?.libelle}
            </span>{" "}
            — le Studio d&apos;AvecStudy. Les noms de classe et de chapitre sont
            des exemples.
          </>
        ) : (
          <>
            Le Studio d&apos;AvecStudy. Les noms de classe et de chapitre sont
            des exemples.
          </>
        )}
      </p>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function BarreFenetre({ cotEleve }: { cotEleve: boolean }) {
  return (
    <div className="flex items-center justify-between gap-3 border-b border-[color:var(--color-bordure)] px-4 py-2.5">
      <span className="text-[0.8125rem] font-extrabold tracking-[-0.03em]">AvecStudy</span>
      <span
        className={`pastille ${cotEleve ? "pastille-publie" : "pastille-brouillon"} transition-colors duration-300`}
      >
        {cotEleve ? "Vue élève" : "Studio — professeur"}
      </span>
    </div>
  );
}

function Colonne({ cotEleve, rang }: { cotEleve: boolean; rang: number }) {
  const seances = [
    { titre: "Définition d'une suite", actif: false },
    { titre: "Suites arithmétiques", actif: false },
    { titre: "Suites géométriques", actif: rang >= 1 },
  ];

  return (
    <aside className="border-r border-[color:var(--color-bordure)] bg-[color:var(--color-surface-douce)] p-3 sm:p-4">
      <p className="m-0 text-[0.625rem] font-semibold uppercase tracking-[0.07em] text-[color:var(--color-encre-tres-faible)]">
        {cotEleve ? "Mes cours" : "Mes classes"}
      </p>
      <p className="m-0 mt-1.5 text-[0.8125rem] font-semibold">Mathématiques</p>
      <p className="m-0 text-[0.6875rem] text-[color:var(--color-encre-faible)]">Première 3</p>

      <p className="m-0 mt-5 text-[0.625rem] font-semibold uppercase tracking-[0.07em] text-[color:var(--color-encre-tres-faible)]">
        Chapitre 4 — Suites
      </p>

      <ul className="m-0 mt-2 list-none space-y-0.5 p-0">
        {seances.map((seance, index) => (
          <li
            key={seance.titre}
            className={`truncate rounded-[6px] px-2 py-1.5 text-[0.75rem] transition-all duration-300 ${
              seance.actif
                ? "bg-[color:var(--color-rose-clair)] font-semibold text-[color:var(--color-accent)]"
                : "text-[color:var(--color-encre-faible)]"
            } ${index === 2 && rang < 1 ? "opacity-0" : "opacity-100"}`}
          >
            {seance.titre}
          </li>
        ))}
      </ul>
    </aside>
  );
}

function Seance({ etape, rang, cotEleve }: { etape: Cle; rang: number; cotEleve: boolean }) {
  if (rang === 0) {
    return (
      <div className="flex items-center justify-center p-6">
        <span className="rounded-[var(--radius-champ)] border border-dashed border-[color:var(--color-bordure-forte)] px-4 py-3 text-[0.8125rem] text-[color:var(--color-encre-faible)]">
          + Nouvelle séance
        </span>
      </div>
    );
  }

  return (
    <div className="p-4 sm:p-6">
      <div className="flex flex-wrap items-start justify-between gap-2">
        <div className="min-w-0">
          <h3 className="truncate text-[0.9375rem] leading-snug sm:text-[1.0625rem]">
            Suites géométriques
          </h3>
          <p className="m-0 mt-1 text-[0.6875rem] text-[color:var(--color-encre-faible)]">
            Jeudi 11 septembre · Première 3 · Chapitre 4
          </p>
        </div>
        <span
          className={`pastille transition-colors duration-500 ${
            rang >= 5 ? "pastille-publie" : "pastille-brouillon"
          }`}
        >
          {rang >= 5 ? "Publiée" : "Brouillon"}
        </span>
      </div>

      <div className="mt-4 space-y-2">
        <Bloc visible={rang >= 2} type="Texte">
          <p className="m-0 text-[0.75rem] leading-[1.15rem]">
            Définition, raison, sens de variation. Exemples au tableau puis
            exercices 12 à 18.
          </p>
        </Bloc>

        <Bloc visible={rang >= 3} type="Document">
          <p className="m-0 text-[0.75rem] font-medium">Fiche d&apos;exercices — suites.pdf</p>
          <p className="m-0 mt-0.5 text-[0.6875rem] text-[color:var(--color-encre-faible)]">
            3 pages · déposé par M. Martin
          </p>
        </Bloc>

        <Bloc visible={rang >= 4} type="Devoir" accent>
          <p className="m-0 text-[0.75rem] font-medium">Devoir maison n° 2</p>
          <p className="m-0 mt-0.5 text-[0.6875rem] text-[color:var(--color-encre-faible)]">
            À rendre le 18 septembre
          </p>
        </Bloc>
      </div>

      {cotEleve ? (
        <p className="mt-4 rounded-[var(--radius-champ)] bg-[color:var(--color-rose-clair)] px-3 py-2 text-[0.6875rem] font-medium text-[color:var(--color-accent)]">
          Visible par les 31 élèves de Première 3, et par eux seuls.
        </p>
      ) : (
        <p className="mt-4 text-[0.6875rem] text-[color:var(--color-encre-tres-faible)]">
          {rang >= 5 ? "Publiée il y a quelques secondes" : "Enregistré automatiquement"}
        </p>
      )}
      <span className="sr-only">{etape}</span>
    </div>
  );
}

function Bloc({
  visible,
  type,
  accent = false,
  children,
}: {
  visible: boolean;
  type: string;
  accent?: boolean;
  children: React.ReactNode;
}) {
  return (
    <div
      className={`rounded-[var(--radius-champ)] border px-3 py-2.5 transition-all duration-500 ${
        accent
          ? "border-[color:var(--color-rose-decor)]"
          : "border-[color:var(--color-bordure)]"
      } ${visible ? "translate-y-0 opacity-100" : "pointer-events-none -translate-y-1 opacity-0"}`}
    >
      <p className="m-0 text-[0.5625rem] font-semibold uppercase tracking-[0.07em] text-[color:var(--color-encre-tres-faible)]">
        {type}
      </p>
      <div className="mt-1">{children}</div>
    </div>
  );
}
