"use client";

import { Lock } from "lucide-react";
import { useEffect, useRef, useState, useTransition } from "react";
import { enregistrerNote, type EtatNote } from "@/app/app/seances/actions";
import { cleBrouillonNote, garderBrouillon, retirerBrouillonConfirme } from "@/lib/v6/brouillon-note";
import { useStockage } from "./horloge";

/**
 * Note privée d'une séance — E03. Enregistrement automatique avec état
 * visible ; verrou optimiste : si un autre onglet a enregistré entre-temps,
 * le conflit est montré et le texte local est conservé, jamais écrasé.
 * Brouillon local de secours si le réseau tombe (même appareil seulement).
 */
export function NotePrivee({ seance, initiale, revision, proprietaire, autoriserBrouillon = false }: { seance: string; initiale: string; revision: number; proprietaire: string; autoriserBrouillon?: boolean }) {
  const [texte, setTexte] = useState(initiale);
  const [etat, setEtat] = useState<EtatNote>({ etat: "inchange", revision });
  const [enCours, demarrer] = useTransition();
  const dernier = useRef(initiale);
  const cle = cleBrouillonNote(proprietaire, seance, autoriserBrouillon);

  // Un brouillon local plus récent (coupure réseau) est proposé, pas imposé.
  const stocke = useStockage(cle);
  const [ecarte, setEcarte] = useState(false);
  const brouillonLocal = !ecarte && stocke !== null && stocke !== initiale && stocke !== texte ? stocke : null;
  const setBrouillonLocal = (_: null) => setEcarte(true);

  useEffect(() => {
    if (texte === dernier.current || etat.etat === "conflit") return;
    const minuterie = window.setTimeout(() => {
      let copieGardee = false;
      if (cle !== null) {
        try { copieGardee = garderBrouillon(window.localStorage, cle, texte); } catch { /* stockage bloqué */ }
      }
      demarrer(async () => {
        try {
          const resultat = await enregistrerNote(seance, texte, etat.revision, proprietaire);
          setEtat(resultat);
          if (resultat.etat === "enregistre") {
            dernier.current = texte;
            try {
              retirerBrouillonConfirme(window.localStorage, cle, texte);
            } catch {
              /* ignoré */
            }
          }
        } catch {
          setEtat((e) => ({ ...e, etat: "erreur", message: copieGardee ? "Enregistrement impossible. Un brouillon est conservé sur cet appareil." : "Enregistrement impossible. Garde cette page ouverte ou copie ton texte avant de la quitter." }));
        }
      });
    }, 900);
    return () => window.clearTimeout(minuterie);
  }, [texte, seance, etat.revision, etat.etat, cle, proprietaire]);

  const statut =
    enCours
      ? "Enregistrement…"
      : etat.etat === "enregistre"
        ? `Enregistrée à ${new Date(etat.enregistreLe ?? 0).toLocaleTimeString("fr-FR", { hour: "2-digit", minute: "2-digit" })}`
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
