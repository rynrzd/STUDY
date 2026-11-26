"use client";

import { useActionState } from "react";
import { creerClasse, type EtatCreationClasse } from "./actions";

export function FormulaireCreationClasse({ retour }: { retour?: { document: string; revision: string } }) {
  const [etat, action, attente] = useActionState<EtatCreationClasse, FormData>(creerClasse, {});
  return <form action={action} className="mx-auto grid max-w-xl gap-4 rounded-[var(--radius-carte)] border border-[color:var(--color-bordure)] bg-[color:var(--color-surface)] p-6" noValidate>
    {retour ? <><input type="hidden" name="document" value={retour.document} /><input type="hidden" name="revision" value={retour.revision} /></> : null}
    <div><label className="etiquette" htmlFor="classe">Nom de la classe</label><input id="classe" name="classe" className="champ" placeholder="STI2D" minLength={2} maxLength={80} required /></div>
    <div><label className="etiquette" htmlFor="matiere">Première matière</label><input id="matiere" name="matiere" className="champ" placeholder="Français" minLength={2} maxLength={80} required /></div>
    {etat.message ? <p role="alert" className="m-0 text-[color:var(--color-erreur)]">{etat.message}</p> : null}
    <button className="bouton bouton-primaire" disabled={attente}>{attente ? "Création…" : "Créer la classe"}</button>
    <p className="aide-champ m-0">La classe est créée dans ton espace. Aucun lycée ni code établissement n’est nécessaire.</p>
  </form>;
}
