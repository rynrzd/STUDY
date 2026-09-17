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
      {/* Une seule rangée, jamais deux : trois onglets qui se coupent en
          « Sur ordinateur / Sur papier » puis « À la maison » au centre ne
          ressemblent plus à des onglets. Sur un écran étroit, la rangée défile. */}
      <div
        role="tablist"
        aria-label="Situations d'usage"
        className="sans-barre -mx-5 flex justify-start gap-1 overflow-x-auto px-5 sm:mx-0 sm:justify-center sm:px-0"
      >
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
              className={`min-h-[var(--spacing-cible)] shrink-0 whitespace-nowrap border-b-2 px-4 text-[length:var(--text-tableau)] transition-colors duration-[160ms] sm:px-5 ${
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
            className={`col-start-1 row-start-1 grid items-center gap-8 lg:grid-cols-[minmax(0,0.85fr)_minmax(0,1.15fr)] ${
              onglet.cle === actif ? "panneau-onglet" : ""
            }`}
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

/**
 * FAQ — L08.
 *
 * `<details>` plutôt qu'un état React : l'accordéon s'ouvre au clic et au
 * clavier **sans JavaScript**, ce que le chapitre 10 exige explicitement. Avec
 * un `useState`, une réponse restait repliée et inatteignable tant que
 * l'hydratation n'avait pas eu lieu — sur un réseau de lycée, cela peut durer.
 *
 * L'ouverture est animée par `grid-template-rows`, seule façon d'animer une
 * hauteur inconnue sans la mesurer : la page ne saute pas.
 */
export function Faq({ questions }: { questions: readonly Question[] }) {
  return (
    <div className="border-t border-[color:var(--color-bordure)]">
      {questions.map((entree) => (
        <details
          key={entree.question}
          name="faq"
          className="groupe-repli border-b border-[color:var(--color-bordure)]"
        >
          <summary className="flex min-h-[var(--spacing-cible)] cursor-pointer list-none items-center justify-between gap-4 py-4 text-[length:var(--text-corps)] font-medium">
            {entree.question}
            <span
              aria-hidden="true"
              className="marqueur-repli shrink-0 text-[1.25rem] font-light text-[color:var(--color-encre-tres-faible)] transition-transform duration-[180ms]"
            >
              +
            </span>
          </summary>

          <div className="repli">
            <div>
              <p className="m-0 max-w-[var(--spacing-lecture)] pb-5 text-[length:var(--text-corps)] leading-[var(--text-corps--line-height)] text-[color:var(--color-encre-faible)]">
                {entree.reponse}
              </p>
            </div>
          </div>
        </details>
      ))}
    </div>
  );
}
