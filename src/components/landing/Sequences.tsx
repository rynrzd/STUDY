"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";

/**
 * Séquences de démonstration de la landing — chapitre 34.
 *
 * Deux séquences, deux comportements exigés :
 *  - Publication prof : 3 étapes, **lancée par un bouton**, jamais toute seule.
 *  - Import Excel : 4 étapes sur 4 secondes, avec **arrêter / rejouer**.
 *
 * Règles communes : en mouvement réduit, aucune séquence automatique — l'état
 * final est affiché et les contrôles restent utilisables. Le contenu de chaque
 * étape est présent dans le HTML rendu serveur ; la séquence ne fait que
 * révéler progressivement ce qui est déjà là.
 */

function mouvementReduit(): boolean {
  if (typeof window === "undefined") return false;
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

/** Minuteur d'étapes, nettoyé au démontage (ch. 34 : pas de fuite de timer). */
function useSequence(nombreEtapes: number, dureeMs: number) {
  const [etape, setEtape] = useState(0);
  const [joue, setJoue] = useState(false);
  const minuterie = useRef<ReturnType<typeof setInterval> | null>(null);

  const arreter = useCallback(() => {
    if (minuterie.current !== null) {
      clearInterval(minuterie.current);
      minuterie.current = null;
    }
    setJoue(false);
  }, []);

  const lancer = useCallback(() => {
    arreter();
    if (mouvementReduit()) {
      // Pas de séquence automatique : on montre directement le résultat.
      setEtape(nombreEtapes - 1);
      return;
    }
    setEtape(0);
    setJoue(true);
    minuterie.current = setInterval(() => {
      setEtape((precedente) => {
        if (precedente >= nombreEtapes - 1) {
          if (minuterie.current !== null) {
            clearInterval(minuterie.current);
            minuterie.current = null;
          }
          setJoue(false);
          return precedente;
        }
        return precedente + 1;
      });
    }, dureeMs / nombreEtapes);
  }, [arreter, dureeMs, nombreEtapes]);

  useEffect(() => arreter, [arreter]);

  return { etape, joue, lancer, arreter, allerA: setEtape };
}

/* ========================================================================== */
/* Publication : choisir Seconde 1, puis montrer la séance publiée            */
/* ========================================================================== */

const ETAPES_PUBLICATION = [
  {
    titre: "Choisir la classe",
    detail: "Seule Seconde 1 est cochée. Seconde 2 reste non publiée.",
  },
  {
    titre: "Vérifier avant de publier",
    detail: "32 élèves concernés. Le corrigé reste masqué.",
  },
  {
    titre: "Publié en Seconde 1",
    detail: "La séance n'apparaît pas en Seconde 2.",
  },
] as const;

export function SequencePublication() {
  const base = useId();
  const { etape, joue, lancer } = useSequence(ETAPES_PUBLICATION.length, 2400);
  const [demarree, setDemarree] = useState(false);

  function demarrer() {
    setDemarree(true);
    lancer();
  }

  const courante = ETAPES_PUBLICATION[etape]!;

  return (
    <div className="rounded-[var(--radius-carte)] border border-[color:var(--color-bordure)] bg-[color:var(--color-surface)] p-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="m-0 text-[length:var(--text-aide)] text-[color:var(--color-encre-faible)]">
          Publier une séance, étape par étape
        </p>
        <button
          type="button"
          onClick={demarrer}
          disabled={joue}
          aria-describedby={`${base}-etat`}
          className="bouton bouton-clair min-h-[36px] px-4 text-[length:var(--text-aide)] disabled:opacity-60"
        >
          {demarree ? "Rejouer" : "Voir la publication"}
          <span aria-hidden="true" className="fleche">→</span>
        </button>
      </div>

      <ol className="mt-4 m-0 list-none space-y-2 p-0">
        {ETAPES_PUBLICATION.map((element, index) => {
          const atteinte = demarree && index <= etape;
          return (
            <li
              key={element.titre}
              className={`etape-sequence flex items-start gap-3 rounded-[var(--radius-champ)] p-2 ${
                atteinte ? "bg-[color:var(--color-rose-selection)]" : ""
              }`}
            >
              <span
                className={`mt-0.5 inline-flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold ${
                  atteinte
                    ? "bg-[color:var(--color-encre)] text-[color:var(--color-surface)]"
                    : "border border-[color:var(--color-bordure)] text-[color:var(--color-encre-faible)]"
                }`}
              >
                {index + 1}
              </span>
              <span className="text-[length:var(--text-aide)] leading-[var(--text-aide--line-height)]">
                <span className="font-semibold">{element.titre}</span>
                <span className="block text-[color:var(--color-encre-faible)]">{element.detail}</span>
              </span>
            </li>
          );
        })}
      </ol>

      {/* Le résultat de la séquence est annoncé aux lecteurs d'écran. */}
      <p
        id={`${base}-etat`}
        aria-live="polite"
        className="mt-3 m-0 text-[length:var(--text-aide)] text-[color:var(--color-encre-faible)]"
      >
        {demarree ? `Étape ${etape + 1} sur ${ETAPES_PUBLICATION.length} — ${courante.titre}` : ""}
      </p>
    </div>
  );
}

/* ========================================================================== */
/* Import Excel : lignes du fichier, puis regroupement en classes             */
/* ========================================================================== */

const LIGNES = [
  { prenom: "Emma", nom: "Laurent", classe: "Seconde 1" },
  { prenom: "Rayan", nom: "Benali", classe: "Seconde 1" },
  { prenom: "Inès", nom: "Moreau", classe: "Seconde 2" },
] as const;

const ETAPES_IMPORT = ["Fichier reçu", "Lignes lues", "Classes regroupées", "Récapitulatif"] as const;

export function SequenceImport() {
  const base = useId();
  const { etape, joue, lancer, arreter, allerA } = useSequence(ETAPES_IMPORT.length, 4000);
  const conteneur = useRef<HTMLDivElement>(null);
  const dejaLance = useRef(false);

  // Démarrage à l'entrée dans l'écran, une seule fois. En mouvement réduit, on
  // affiche directement le récapitulatif sans rien animer.
  useEffect(() => {
    const element = conteneur.current;
    if (element === null) return;

    if (mouvementReduit()) {
      allerA(ETAPES_IMPORT.length - 1);
      return;
    }
    if (typeof IntersectionObserver === "undefined") {
      allerA(ETAPES_IMPORT.length - 1);
      return;
    }

    const observateur = new IntersectionObserver(
      (entrees) => {
        for (const entree of entrees) {
          if (!entree.isIntersecting || dejaLance.current) continue;
          dejaLance.current = true;
          lancer();
          observateur.disconnect();
        }
      },
      { threshold: 0.35 },
    );
    observateur.observe(element);
    return () => observateur.disconnect();
  }, [lancer, allerA]);

  const lignesVisibles = etape >= 1 ? LIGNES.length : 0;
  const groupe = etape >= 2;
  const recapitulatif = etape >= 3;

  return (
    <div
      ref={conteneur}
      className="rounded-[var(--radius-carte)] border border-[color:var(--color-bordure)] bg-[color:var(--color-surface)] p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <span
            className="inline-flex h-8 w-8 items-center justify-center rounded-[6px] text-[11px] font-semibold text-white"
            style={{ background: "var(--color-succes)" }}
            aria-hidden="true"
          >
            xls
          </span>
          <div>
            <p className="m-0 text-[length:var(--text-aide)] font-semibold">Eleves.xlsx</p>
            <p className="m-0 text-[length:var(--text-aide)] text-[color:var(--color-encre-faible)]">
              {etape >= 1 ? `${LIGNES.length} élèves détectés` : "Lecture du fichier…"}
            </p>
          </div>
        </div>

        {/* Arrêter / rejouer, exigés au ch. 34. */}
        <div className="flex gap-2">
          <button
            type="button"
            onClick={arreter}
            disabled={!joue}
            className="bouton bouton-clair min-h-[36px] px-3 text-[length:var(--text-aide)] disabled:opacity-50"
          >
            Arrêter
          </button>
          <button
            type="button"
            onClick={lancer}
            className="bouton bouton-clair min-h-[36px] px-3 text-[length:var(--text-aide)]"
          >
            Rejouer
          </button>
        </div>
      </div>

      <div className="mt-4 overflow-x-auto">
        <table className="w-full border-collapse text-[length:var(--text-aide)] leading-[var(--text-aide--line-height)]">
          <caption className="sr-only">
            Aperçu fictif des lignes lues dans un fichier de rentrée
          </caption>
          <thead>
            <tr className="border-b border-[color:var(--color-bordure)] text-left text-[color:var(--color-encre-faible)]">
              <th scope="col" className="py-2 pr-3 font-medium">Prénom</th>
              <th scope="col" className="py-2 pr-3 font-medium">Nom</th>
              <th scope="col" className="py-2 font-medium">Classe</th>
            </tr>
          </thead>
          <tbody>
            {LIGNES.map((ligne, index) => (
              <tr
                key={`${ligne.prenom}-${ligne.nom}`}
                className="etape-sequence border-b border-[color:var(--color-bordure)] last:border-b-0"
                style={{
                  opacity: index < lignesVisibles ? 1 : 0,
                  transform: index < lignesVisibles ? "none" : "translateY(6px)",
                  transitionDelay: `${index * 90}ms`,
                }}
              >
                <td className="py-2 pr-3">{ligne.prenom}</td>
                <td className="py-2 pr-3">{ligne.nom}</td>
                <td className="py-2">
                  <span
                    className="etape-sequence inline-block rounded-[6px] px-2 py-0.5"
                    style={{
                      background: groupe ? "var(--color-rose-selection)" : "transparent",
                    }}
                  >
                    {ligne.classe}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <div
        className="etape-sequence mt-4 rounded-[var(--radius-champ)] bg-[color:var(--color-fond)] p-3"
        style={{ opacity: recapitulatif ? 1 : 0.25 }}
      >
        <p className="m-0 text-[length:var(--text-aide)] font-semibold">
          2 classes à créer, 3 élèves à ajouter
        </p>
        <p className="mt-1 m-0 text-[length:var(--text-aide)] text-[color:var(--color-encre-faible)]">
          Rien n&apos;est créé tant que vous n&apos;avez pas confirmé.
        </p>
      </div>

      <p
        id={`${base}-etat`}
        aria-live="polite"
        className="mt-3 m-0 text-[length:var(--text-aide)] text-[color:var(--color-encre-faible)]"
      >
        Étape {etape + 1} sur {ETAPES_IMPORT.length} — {ETAPES_IMPORT[etape]}
      </p>
    </div>
  );
}
