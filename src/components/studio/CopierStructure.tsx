"use client";

import { useActionState, useState } from "react";
import { Copy } from "lucide-react";
import { copierStructure } from "@/app/studio/actions";
import { ETAT_STUDIO_INITIAL, type EtatStudio } from "@/app/studio/etats";

const MODES = [
  ["structure", "Les chapitres seulement", "Une trame vide, à remplir"],
  ["brouillons", "Les chapitres et les séances, en brouillon", "Rien n'est montré aux élèves ; aucun devoir n'est recopié"],
  ["publier", "Et publier les séances déjà publiées dans l'autre cours", "Les autres restent des brouillons"],
] as const;

/**
 * Copier la structure d'un autre cours (COURS-08, COURS-09, COURS-15) : de
 * cette année ou d'une année passée que l'on enseignait. Trois niveaux,
 * nommés ; rien ne part sans le bouton.
 */
export function CopierStructure({ cible, sources }: { cible: string; sources: readonly { id: string; libelle: string }[] }) {
  const [ouvert, setOuvert] = useState(false);
  const [etat, action] = useActionState<EtatStudio, FormData>(async (p, d) => {
    try {
      return await copierStructure(p, d);
    } catch {
      return { etat: "erreur", message: "La réponse du serveur n'est pas arrivée." };
    }
  }, ETAT_STUDIO_INITIAL);
  if (sources.length === 0) return null;
  if (!ouvert) {
    return (
      <button type="button" className="bouton bouton-compact bouton-discret" onClick={() => setOuvert(true)}>
        <Copy size={16} strokeWidth={1.75} aria-hidden="true" /> Copier la structure d&apos;un autre cours
      </button>
    );
  }
  return (
    <form action={action} className="panneau mt-3">
      <input type="hidden" name="cible" value={cible} />
      <label className="etiquette" htmlFor="copie-source">
        Depuis
      </label>
      <select id="copie-source" name="source" className="champ" defaultValue="" required>
        <option value="" disabled>
          Choisir un cours…
        </option>
        {sources.map((s) => (
          <option key={s.id} value={s.id}>
            {s.libelle}
          </option>
        ))}
      </select>
      <fieldset className="m-0 mt-3 border-0 p-0">
        <legend className="etiquette">Copier</legend>
        {MODES.map(([v, titre, detail], i) => (
          <label key={v} className="mt-1 flex items-start gap-2 text-[0.9375rem]">
            <input type="radio" name="mode" value={v} defaultChecked={i === 0} className="mt-1 accent-[color:var(--color-accent)]" />
            <span>
              {titre}
              <span className="aide-champ">{detail}</span>
            </span>
          </label>
        ))}
      </fieldset>
      <div className="mt-3 flex flex-wrap gap-2">
        <button type="submit" className="bouton bouton-compact bouton-primaire">
          Copier
        </button>
        <button type="button" className="bouton bouton-compact bouton-discret" onClick={() => setOuvert(false)}>
          Fermer
        </button>
      </div>
      {etat.message ? (
        <p role="status" className={`m-0 mt-2 text-[0.875rem] ${etat.etat === "ok" ? "text-[color:var(--color-succes)]" : "text-[color:var(--color-erreur)]"}`}>
          {etat.message}
        </p>
      ) : null}
    </form>
  );
}
