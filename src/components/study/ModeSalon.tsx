"use client";

import { useState, useTransition } from "react";
import { changerMode } from "@/app/app/messagerie/actions";

/** Le professeur choisit le mode du salon ; la base l'applique à tous les chemins (CHAT-02). */
export function ModeSalon({ salon, mode, chemin }: { salon: string; mode: string; chemin: string }) {
  const [enCours, demarrer] = useTransition();
  const [erreur, setErreur] = useState<string | null>(null);
  return (
    <div className="mb-3 flex flex-wrap items-center gap-2 text-[0.8125rem]">
      <label htmlFor={`mode-${salon}`} className="font-semibold">
        Mode du salon
      </label>
      <select
        id={`mode-${salon}`}
        className="champ w-auto min-h-[36px] py-1"
        defaultValue={mode}
        disabled={enCours}
        onChange={(e) => {
          const valeur = e.target.value;
          demarrer(async () => {
            const r = await changerMode(salon, valeur, chemin);
            setErreur(r.ok ? null : r.message);
          });
        }}
      >
        <option value="discussion">Discussion ouverte</option>
        <option value="questions">Questions seulement</option>
        <option value="annonces">Annonces seulement</option>
      </select>
      {enCours ? <span className="meta">Enregistrement…</span> : null}
      {erreur ? (
        <span role="alert" className="text-[color:var(--color-erreur)]">
          {erreur}
        </span>
      ) : null}
      <span className="meta">Le changement est journalisé.</span>
    </div>
  );
}
