"use client";

import { useActionState, useState } from "react";
import { creerClasse, type EtatCreationClasse } from "./actions";
import { nomNormalise, type EnseignementSouhaite } from "@/lib/projet-professeur";

export function FormulaireCreationClasse({ retour, proposition, classesExistantes = [] }: {
  retour?: { document: string; revision: string };
  proposition?: EnseignementSouhaite;
  classesExistantes?: readonly { label: string; matieres: readonly string[] }[];
}) {
  const [etat, action, attente] = useActionState<EtatCreationClasse, FormData>(creerClasse, {});
  const [classe, setClasse] = useState("");
  const [matiere, setMatiere] = useState("");
  const classeExistante = classe.trim().length >= 2 ? classesExistantes.find((c) => nomNormalise(c.label) === nomNormalise(classe)) : undefined;
  const enseignementExistant = classeExistante?.matieres.some((m) => nomNormalise(m) === nomNormalise(matiere)) ?? false;
  if (proposition) return (
    <form action={action} className="flex flex-wrap items-center gap-3 rounded-xl border border-[color:var(--color-bordure)] bg-[color:var(--color-surface)] p-4" noValidate>
      <input type="hidden" name="classe" value={proposition.classe} />
      <input type="hidden" name="matiere" value={proposition.matiere} />
      <div className="min-w-0 flex-1">
        <span className="block font-bold">{proposition.classe}</span>
        <span className="text-sm text-[color:var(--color-encre-faible)]">{proposition.matiere}</span>
      </div>
      <button className="bouton bouton-primaire" disabled={attente}>{attente ? "Création…" : "Créer"}</button>
      {etat.message ? <p role="alert" className="w-full text-sm text-[color:var(--color-erreur)]">{etat.message}</p> : null}
    </form>
  );
  return <form action={action} className="grid gap-5 rounded-[var(--radius-carte)] border border-[color:var(--color-bordure)] bg-[color:var(--color-surface)] p-6 sm:p-8" noValidate>
    {retour ? <><input type="hidden" name="document" value={retour.document} /><input type="hidden" name="revision" value={retour.revision} /></> : null}
    <div><label className="etiquette" htmlFor="classe">Comment s&apos;appelle ta classe ?</label><input id="classe" name="classe" className="champ" placeholder="Par exemple : Première générale" minLength={2} maxLength={80} value={classe} onChange={(e) => setClasse(e.target.value)} list="noms-classes-existantes" required /><datalist id="noms-classes-existantes">{classesExistantes.map((c) => <option key={c.label} value={c.label} />)}</datalist><p className="aide-champ mb-0">Reprends le nom d&apos;une classe existante pour lui ajouter une matière.</p></div>
    <div><label className="etiquette" htmlFor="matiere">Quelle matière enseignes-tu ?</label><input id="matiere" name="matiere" className="champ" placeholder="Par exemple : Français" minLength={2} maxLength={80} value={matiere} onChange={(e) => setMatiere(e.target.value)} required /><p className="aide-champ mb-0">Tu pourras préparer tes premiers supports pour cette matière.</p></div>
    {classeExistante && !enseignementExistant ? <p className="m-0 rounded-lg bg-[color:var(--color-rose-clair)] p-3 text-sm">La classe « {classeExistante.label} » existe déjà. Tu vas y ajouter une nouvelle matière, sans dupliquer la classe.</p> : null}
    {enseignementExistant ? <p role="status" className="m-0 rounded-lg bg-[color:var(--color-rose-clair)] p-3 text-sm">« {classeExistante?.label} · {matiere} » existe déjà. Choisis une autre matière ou une autre classe.</p> : null}
    {etat.message ? <p role="alert" className="m-0 text-[color:var(--color-erreur)]">{etat.message}</p> : null}
    <button className="bouton bouton-primaire" disabled={attente || enseignementExistant}>{attente ? "Création…" : classeExistante ? "Ajouter cette matière" : "Créer ma classe et continuer"}</button>
    <p className="aide-champ m-0">Aucun lycée ni code établissement n&apos;est demandé. Rien n&apos;est envoyé aux élèves à cette étape.</p>
  </form>;
}
