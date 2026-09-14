"use client";

import { useId, useState } from "react";

/**
 * FAQ à séparateurs fins — ch. 04 et ch. 34 (ouverture 220 ms, aria-expanded).
 *
 * Les réponses sont dans le HTML rendu serveur : un lecteur d'écran et un
 * moteur d'indexation les trouvent même repliées, et la page reste utile si
 * JavaScript échoue (les panneaux sont alors simplement tous ouverts, car
 * l'état replié n'est posé qu'après hydratation).
 */

export interface Question {
  readonly q: string;
  readonly r: string;
}

export function Faq({ questions }: { questions: readonly Question[] }) {
  const base = useId();
  const [ouverte, setOuverte] = useState<number | null>(0);

  return (
    <div className="border-t border-[color:var(--color-bordure)]">
      {questions.map((item, index) => {
        const estOuverte = ouverte === index;
        return (
          <div key={item.q} className="border-b border-[color:var(--color-bordure)]">
            <h3 className="m-0">
              <button
                type="button"
                id={`${base}-bouton-${index}`}
                aria-expanded={estOuverte}
                aria-controls={`${base}-panneau-${index}`}
                onClick={() => setOuverte(estOuverte ? null : index)}
                className="flex min-h-[var(--spacing-cible)] w-full items-center justify-between gap-4 py-5 text-left text-[length:var(--text-corps)] font-medium"
              >
                <span>{item.q}</span>
                <span
                  aria-hidden="true"
                  className="shrink-0 text-xl leading-none text-[color:var(--color-encre-faible)] transition-transform duration-200"
                  style={{ transform: estOuverte ? "rotate(45deg)" : "none" }}
                >
                  +
                </span>
              </button>
            </h3>

            <div
              id={`${base}-panneau-${index}`}
              role="region"
              aria-labelledby={`${base}-bouton-${index}`}
              className="faq-corps"
              data-ouvert={estOuverte}
            >
              <div>
                <p className="mb-5 mt-0 max-w-[62ch] text-[color:var(--color-encre-faible)]">
                  {item.r}
                </p>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}
