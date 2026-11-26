"use client";

import { useActionState } from "react";
import { enregistrerNotions } from "@/app/professeur/devoirs/actions";
import { ETAT_DEVOIR_INITIAL } from "@/app/professeur/devoirs/etats";

export function NotionsDevoir({ devoir, notions, selection }: {
  devoir: string;
  notions: readonly { id: string; label: string }[];
  selection: readonly string[];
}) {
  const [etat, action, attente] = useActionState(enregistrerNotions, ETAT_DEVOIR_INITIAL);
  return <form action={action} className="panneau mt-6">
    <input type="hidden" name="devoir" value={devoir} />
    <fieldset className="border-0 p-0">
      <legend className="titre-section">Notions à réviser</legend>
      <p>Choisissez les notions utiles au devoir. Vous pouvez laisser cette sélection vide.</p>
      {notions.map(n => <label key={n.id} className="flex min-h-12 items-center gap-3">
        <input type="checkbox" name="notion" value={n.id} defaultChecked={selection.includes(n.id)} />{n.label}
      </label>)}
      {notions.length === 0 ? <p>Aucune notion associée à cet enseignement.</p> : null}
    </fieldset>
    <button className="bouton bouton-secondaire" disabled={attente}>Enregistrer les notions</button>
    {etat.etat !== "vierge" ? <p role={etat.etat === "erreur" ? "alert" : "status"}>{etat.message}</p> : null}
  </form>;
}
