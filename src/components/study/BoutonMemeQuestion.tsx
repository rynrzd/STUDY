"use client";

import { useState, useTransition } from "react";
import { CircleHelp } from "lucide-react";
import { memeQuestion } from "@/app/app/messagerie/actions";

/**
 * « J'ai la même question », depuis la séance. Même action serveur que dans le
 * salon (`salon_meme_question`, droits revérifiés en base) ; l'état affiché
 * est celui que le serveur renvoie, pas une supposition.
 */
export function BoutonMemeQuestion({ message, actif, nombre }: { message: string; actif: boolean; nombre: number }) {
  const [etat, setEtat] = useState({ actif, nombre });
  const [erreur, setErreur] = useState<string | null>(null);
  const [enCours, demarrer] = useTransition();

  return (
    <>
      <button
        type="button"
        className="bouton bouton-compact bouton-discret"
        aria-pressed={etat.actif}
        disabled={enCours}
        onClick={() =>
          demarrer(async () => {
            setErreur(null);
            const r = await memeQuestion(message, !etat.actif);
            if (!r.ok) {
              setErreur("Action impossible pour l'instant.");
              return;
            }
            setEtat({ actif: !etat.actif, nombre: typeof r.valeur === "number" ? r.valeur : etat.nombre });
          })
        }
      >
        <CircleHelp size={16} strokeWidth={1.75} aria-hidden="true" />
        {etat.actif ? "Tu as la même question" : "J'ai la même question"}
        {etat.nombre > 0 ? ` · ${etat.nombre}` : ""}
      </button>
      {erreur ? (
        <span role="status" className="meta text-[color:var(--color-erreur)]">
          {erreur}
        </span>
      ) : null}
    </>
  );
}
