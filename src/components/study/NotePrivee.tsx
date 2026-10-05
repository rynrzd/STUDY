"use client";

import { Lock } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";
import { enregistrerNote, type EtatNote } from "@/app/app/seances/actions";

/**
 * Note privée d'une séance — E03. Enregistrement automatique avec état
 * visible ; verrou optimiste : si un autre onglet a enregistré entre-temps,
 * le conflit est montré et le texte local est conservé, jamais écrasé.
 * Brouillon local de secours si le réseau tombe (même appareil seulement).
 */
export function NotePrivee({ seance, initiale, revision }: { seance: string; initiale: string; revision: number }) {
  const [texte, setTexte] = useState(initiale);
  const [etat, setEtat] = useState<EtatNote>({ etat: "inchange", revision });
  const [enCours, demarrer] = useTransition();
  const dernier = useRef(initiale);
  const cle = `study-note-${seance}`;

  // Un brouillon local plus récent (coupure réseau) est proposé, pas imposé.
  const [brouillonLocal, setBrouillonLocal] = useState<string | null>(null);
  useEffect(() => {
    try {
      const b = window.localStorage.getItem(cle);
      if (b !== null && b !== initiale) setBrouillonLocal(b);
    } catch {
      /* stockage indisponible : rien à proposer */
    }
  }, [cle, initiale]);

  useEffect(() => {
    if (texte === dernier.current || etat.etat === "conflit") return;
    const minuterie = window.setTimeout(() => {
      try {
        window.localStorage.setItem(cle, texte);
      } catch {
        /* ignoré */
      }
      demarrer(async () => {
        try {
          const resultat = await enregistrerNote(seance, texte, etat.revision);
          setEtat(resultat);
          if (resultat.etat === "enregistre") {
            dernier.current = texte;
            try {
              window.localStorage.removeItem(cle);
            } catch {
              /* ignoré */
            }
          }
        } catch {
          setEtat((e) => ({ ...e, etat: "erreur", message: "Hors ligne : la note est gardée sur cet appareil et sera réessayée." }));
        }
      });
    }, 900);
    return () => window.clearTimeout(minuterie);
  }, [texte, seance, etat.revision, etat.etat, cle]);

  const statut =
    enCours
      ? "Enregistrement…"
      : etat.etat === "enregistre"
        ? `Enregistrée à ${new Date(etat.enregistreLe ?? Date.now()).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`
        : etat.etat === "conflit"
          ? "Une version plus récente existe"
          : etat.etat === "erreur"
            ? (etat.message ?? "Non enregistrée")
            : texte === "" ? "Visible par toi uniquement" : "Enregistrée";

  return (
    <div>
      <label htmlFor={`note-${seance}`} className="mb-2 flex items-center gap-2 text-[0.8125rem] font-semibold">
        <Lock size={16} strokeWidth={1.75} aria-hidden="true" /> Mes notes privées
      </label>
      {brouillonLocal !== null ? (
        <p className="meta m-0 mb-2">
          Un brouillon non envoyé existe sur cet appareil.{" "}
          <button
            type="button"
            className="cursor-pointer border-0 bg-transparent p-0 font-semibold text-[color:var(--color-accent)] underline"
            onClick={() => {
              setTexte(brouillonLocal);
              setBrouillonLocal(null);
            }}
          >
            Le reprendre
          </button>
        </p>
      ) : null}
      <textarea
        id={`note-${seance}`}
        className="champ min-h-[160px] resize-y leading-[1.6]"
        value={texte}
        maxLength={20_000}
        placeholder="Écris une note sur ce cours…"
        onChange={(e) => setTexte(e.target.value)}
        aria-describedby={`note-${seance}-etat`}
      />
      <p id={`note-${seance}-etat`} role="status" className="meta m-0 mt-1.5">
        {statut}
      </p>
      {etat.etat === "conflit" ? (
        <div role="alert" className="mt-2 rounded-[10px] bg-[color:var(--color-attention-fond)] p-3 text-[0.8125rem] text-[color:var(--color-attention)]">
          {etat.message} Copie ton texte si besoin, puis{" "}
          <a href={`/app/seances/${seance}`} className="font-semibold text-[color:var(--color-attention)]">
            recharge la note
          </a>
          .
        </div>
      ) : null}
    </div>
  );
}
