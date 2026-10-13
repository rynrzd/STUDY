"use client";

import { useActionState } from "react";
import { utiliserMatiereExistante } from "@/app/admin/import/actions";
import { ETAT_CORRECTION_INITIAL, type EtatCorrection } from "@/app/admin/import/etats";
import type { Suggestion } from "@/lib/suggestion-matieres";

/**
 * Les matières lues dans le fichier, face à celles déjà créées (IMP-17). Une
 * ressemblance est proposée, jamais appliquée d'office : sans choix, la
 * matière du fichier est créée telle quelle.
 */
export function MatieresDuLot({ lot, suggestions }: { lot: string; suggestions: readonly Suggestion[] }) {
  if (suggestions.length === 0) return null;
  return (
    <section aria-labelledby="titre-matieres-lot" className="carte p-5">
      <h2 id="titre-matieres-lot" className="m-0 text-[length:var(--text-h3)] leading-[var(--text-h3--line-height)]">
        Matières du fichier
      </h2>
      <p className="meta m-0 mt-1 max-w-[70ch]">
        Une matière déjà créée est réutilisée. Une ressemblance vous est proposée ; sans votre choix, la matière du fichier est créée telle quelle.
      </p>
      <ul className="m-0 mt-3 grid list-none gap-2 p-0">
        {suggestions.map((s) => (
          <li key={s.matiere} className="flex flex-wrap items-center justify-between gap-2 border-t border-[color:var(--color-bordure)] pt-2">
            <span>
              <strong>{s.matiere}</strong>{" "}
              <span className="meta">
                {s.etat === "reconnue" ? `— déjà créée (${s.existante})` : s.etat === "nouvelle" ? "— nouvelle, sera créée" : `— ressemble à « ${s.existante} »`}
              </span>
            </span>
            {s.etat === "suggestion" ? <Utiliser lot={lot} de={s.matiere} vers={s.existante} /> : null}
          </li>
        ))}
      </ul>
    </section>
  );
}

function Utiliser({ lot, de, vers }: { lot: string; de: string; vers: string }) {
  const [etat, action, enCours] = useActionState<EtatCorrection, FormData>(utiliserMatiereExistante, ETAT_CORRECTION_INITIAL);
  return (
    <form action={action} className="flex items-center gap-2">
      <input type="hidden" name="lot" value={lot} />
      <input type="hidden" name="de" value={de} />
      <input type="hidden" name="vers" value={vers} />
      <button type="submit" className="bouton bouton-compact bouton-secondaire" disabled={enCours}>
        Utiliser « {vers} »
      </button>
      {etat.message ? (
        <span role="status" className="meta">
          {etat.message}
        </span>
      ) : null}
    </form>
  );
}
