"use client";

import { useActionState } from "react";
import { creerClasse, type EtatCreationClasse } from "./actions";

export function FormulaireCreationClasse({ retour }: { retour?: { document: string; revision: string } }) {
  const [etat, action, attente] = useActionState<EtatCreationClasse, FormData>(creerClasse, {});
  return <form action={action} className="grid gap-5 rounded-[var(--radius-carte)] border border-[color:var(--color-bordure)] bg-[color:var(--color-surface)] p-6 sm:p-8" noValidate>
    {retour ? <><input type="hidden" name="document" value={retour.document} /><input type="hidden" name="revision" value={retour.revision} /></> : null}
    <div><label className="etiquette" htmlFor="classe">Comment s&apos;appelle ta classe ?</label><input id="classe" name="classe" className="champ" placeholder="Par exemple : 3e B" minLength={2} maxLength={80} required /><p className="aide-champ mb-0">Mets le nom que tes élèves connaissent déjà.</p></div>
    <div><label className="etiquette" htmlFor="matiere">Quelle matière enseignes-tu ?</label><input id="matiere" name="matiere" className="champ" placeholder="Par exemple : Mathématiques" minLength={2} maxLength={80} required /><p className="aide-champ mb-0">Tu pourras préparer tes premiers supports pour cette matière.</p></div>
    {etat.message ? <p role="alert" className="m-0 text-[color:var(--color-erreur)]">{etat.message}</p> : null}
    <button className="bouton bouton-primaire" disabled={attente}>{attente ? "Création…" : "Créer ma classe et continuer"}</button>
    <p className="aide-champ m-0">Aucun lycée ni code établissement n&apos;est demandé. Rien n&apos;est envoyé aux élèves à cette étape.</p>
  </form>;
}
