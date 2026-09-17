"use client";

import { useId, useRef, useState } from "react";

/**
 * Onglets et accordéons de la landing — L03 et L08.
 *
 * Les deux suivent le motif ARIA correspondant : rôles, `aria-selected`,
 * `aria-controls`, et les flèches du clavier pour passer d'un onglet à l'autre.
 * Un onglet qui ne répond qu'à la souris n'est pas un onglet, c'est un bouton
 * décoratif.
 *
 * Le contenu de tous les panneaux est rendu côté serveur et masqué par
 * `hidden` : sans JavaScript, la page reste lisible, et rien n'apparaît par
 * surprise après l'hydratation (P02).
 */

export interface Onglet {
  readonly cle: string;
  readonly libelle: string;
  readonly texte: string;
  readonly apercu: React.ReactNode;
}

export function Onglets({ onglets }: { onglets: readonly Onglet[] }) {
  const [actif, setActif] = useState(onglets[0]!.cle);
  const base = useId();
  const boutons = useRef<(HTMLButtonElement | null)[]>([]);

  function auClavier(evenement: React.KeyboardEvent, index: number) {
    const pas =
      evenement.key === "ArrowRight" ? 1 : evenement.key === "ArrowLeft" ? -1 : 0;
    if (pas === 0) return;
    evenement.preventDefault();

    const suivant = (index + pas + onglets.length) % onglets.length;
    setActif(onglets[suivant]!.cle);
    boutons.current[suivant]?.focus();
  }

  return (
    <div>
      <div role="tablist" aria-label="Situations d'usage" className="flex flex-wrap justify-center">
        {onglets.map((onglet, index) => {
          const selectionne = onglet.cle === actif;
          return (
            <button
              key={onglet.cle}
              ref={(element) => {
                boutons.current[index] = element;
              }}
              type="button"
              role="tab"
              id={`${base}-onglet-${onglet.cle}`}
              aria-selected={selectionne}
              aria-controls={`${base}-panneau-${onglet.cle}`}
              tabIndex={selectionne ? 0 : -1}
              onClick={() => setActif(onglet.cle)}
              onKeyDown={(evenement) => auClavier(evenement, index)}
              className={`min-h-[var(--spacing-cible)] border-b-2 px-5 text-[length:var(--text-tableau)] transition-colors duration-[160ms] ${
                selectionne
                  ? "border-[color:var(--color-encre)] font-semibold text-[color:var(--color-encre)]"
                  : "border-transparent text-[color:var(--color-encre-faible)] hover:text-[color:var(--color-encre)]"
              }`}
            >
              {onglet.libelle}
            </button>
          );
        })}
      </div>

      {/* La hauteur ne saute pas d'un onglet à l'autre : les panneaux
          occupent la même grille, un seul est visible. */}
      <div className="mt-8 grid">
        {onglets.map((onglet) => (
          <div
            key={onglet.cle}
            role="tabpanel"
            id={`${base}-panneau-${onglet.cle}`}
            aria-labelledby={`${base}-onglet-${onglet.cle}`}
            hidden={onglet.cle !== actif}
            className="col-start-1 row-start-1 grid items-center gap-8 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)]"
          >
            <p className="m-0 max-w-[46ch] text-[length:var(--text-corps)] leading-[var(--text-corps--line-height)] text-[color:var(--color-encre-faible)]">
              {onglet.texte}
            </p>
            <div>{onglet.apercu}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

export interface Question {
  readonly question: string;
  readonly reponse: string;
}

export function Faq({ questions }: { questions: readonly Question[] }) {
  const base = useId();
  const [ouverte, setOuverte] = useState<string | null>(null);

  return (
    <div className="border-t border-[color:var(--color-bordure)]">
      {questions.map((entree) => {
        const estOuverte = ouverte === entree.question;
        return (
          <div key={entree.question} className="border-b border-[color:var(--color-bordure)]">
            <h3 className="m-0">
              <button
                type="button"
                aria-expanded={estOuverte}
                aria-controls={`${base}-${entree.question.length}`}
                onClick={() => setOuverte(estOuverte ? null : entree.question)}
                className="flex min-h-[var(--spacing-cible)] w-full items-center justify-between gap-4 py-4 text-left text-[length:var(--text-corps)] font-medium"
              >
                {entree.question}
                <span
                  aria-hidden="true"
                  className="shrink-0 text-[1.25rem] font-light text-[color:var(--color-encre-tres-faible)]"
                >
                  {estOuverte ? "−" : "+"}
                </span>
              </button>
            </h3>
            <div id={`${base}-${entree.question.length}`} hidden={!estOuverte}>
              <p className="m-0 max-w-[var(--spacing-lecture)] pb-5 text-[length:var(--text-corps)] leading-[var(--text-corps--line-height)] text-[color:var(--color-encre-faible)]">
                {entree.reponse}
              </p>
            </div>
          </div>
        );
      })}
    </div>
  );
}
