"use client";

import { useActionState } from "react";
import { annoterErreur } from "@/app/app/reviser/actions";
import { BoutonEnvoi, RetourFormulaire, type EtatFormulaire } from "@/components/study/formulaire";

const CATEGORIES = [
  ["", "Catégorie…"],
  ["calcul", "Calcul"],
  ["methode", "Méthode"],
  ["lecture", "Lecture de l'énoncé"],
  ["cours", "Notion du cours"],
  ["inattention", "Inattention"],
  ["autre", "Autre"],
] as const;

export function AnnotationErreur({ entree, revision, categorie, note }: { entree: string; revision: number; categorie: string; note: string }) {
  const [etat, action] = useActionState<EtatFormulaire, FormData>(
    (p: EtatFormulaire, d: FormData) => annoterErreur(entree, Number(p.valeurs?.revision ?? revision), p, d),
    { valeurs: { categorie, note, revision: String(revision) } },
  );
  return (
    <form action={action} className="mt-3 grid gap-2 sm:grid-cols-[180px_1fr_auto] sm:items-end">
      <div>
        <label className="sr-only" htmlFor={`cat-${entree}`}>
          Catégorie
        </label>
        <select id={`cat-${entree}`} name="categorie" className="champ" defaultValue={etat.valeurs?.categorie ?? categorie}>
          {CATEGORIES.map(([v, l]) => (
            <option key={v} value={v}>
              {l}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="sr-only" htmlFor={`note-${entree}`}>
          Ma note
        </label>
        <input id={`note-${entree}`} name="note" className="champ" maxLength={2000} defaultValue={etat.valeurs?.note ?? note} placeholder="Ce que je retiens…" />
      </div>
      <BoutonEnvoi variante="secondaire" className="bouton-compact" enCours="…">
        Enregistrer
      </BoutonEnvoi>
      <div className="sm:col-span-3">
        <RetourFormulaire etat={etat} />
      </div>
    </form>
  );
}
