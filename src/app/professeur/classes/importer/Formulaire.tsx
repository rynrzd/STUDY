"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import type { EleveImporte } from "@/lib/liste-classe";
import { analyserListe, appliquerListe, type EtatImportClasse } from "./actions";

export function FormulaireImportClasse({ classe }: { classe: string }) {
  const [analyse, actionAnalyse, analyseEnCours] = useActionState<EtatImportClasse, FormData>(analyserListe, {});
  if (analyse.etat === "apercu" && analyse.eleves?.length) return <ApercuImport classe={classe} initiaux={analyse.eleves} message={analyse.message} />;
  return <form action={actionAnalyse} className="grid gap-4 rounded-[var(--radius-carte)] border border-[color:var(--color-bordure)] p-6" encType="multipart/form-data"><label className="etiquette" htmlFor="fichier">Liste des élèves</label><input id="fichier" name="fichier" type="file" accept=".pdf,.csv,.xlsx,application/pdf,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" required /><p className="aide-champ m-0">PDF avec texte sélectionnable, CSV ou XLSX, 4 Mo maximum. Colonnes attendues : nom et prénom.</p>{analyse.etat === "erreur" ? <p role="alert" className="text-[color:var(--color-erreur)]">{analyse.message}</p> : null}<button className="bouton bouton-primaire" disabled={analyseEnCours}>{analyseEnCours ? "Lecture…" : "Analyser et vérifier"}</button></form>;
}

function ApercuImport({ classe, initiaux, message }: { classe: string; initiaux: readonly EleveImporte[]; message?: string }) {
  const [application, actionAppliquer, applicationEnCours] = useActionState<EtatImportClasse, FormData>(appliquerListe, {});
  const [eleves, setEleves] = useState<EleveImporte[]>([...initiaux]);
  if (application.etat === "termine") return <div><p role="status" className="rounded-[4px] bg-[color:var(--color-succes-fond)] p-4 font-semibold text-[color:var(--color-succes)]">{application.message}</p><ul className="mt-4 divide-y divide-[color:var(--color-bordure)]">{application.resultats?.map((e) => <li key={`${e.login}-${e.nom}`} className="flex justify-between gap-4 py-2"><span>{e.nom.toUpperCase()} {e.prenom}</span><span className="font-mono text-sm">{e.login}{e.deja ? " · déjà connu" : ""}</span></li>)}</ul><Link className="bouton bouton-primaire mt-6" href={`/app/classes/${classe}/membres`}>Créer les liens ou QR codes d’invitation</Link></div>;
  return <form action={actionAppliquer}>
    <input type="hidden" name="classe" value={classe} /><input type="hidden" name="eleves" value={JSON.stringify(eleves)} />
    <p role="status" className="mb-4 rounded-[4px] bg-[color:var(--color-succes-fond)] p-4">{message}</p>
    <div className="overflow-x-auto"><table className="w-full"><thead><tr><th className="p-2 text-left">Ligne</th><th className="p-2 text-left">Prénom</th><th className="p-2 text-left">Nom</th></tr></thead><tbody>{eleves.map((eleve, index) => <tr key={`${eleve.externe}-${index}`} className="border-t border-[color:var(--color-bordure)]"><td className="p-2">{eleve.ligne}</td><td className="p-2"><input className="champ" value={eleve.prenom} onChange={(e) => setEleves((actuels) => actuels.map((v, i) => i === index ? { ...v, prenom: e.target.value } : v))} /></td><td className="p-2"><input className="champ" value={eleve.nom} onChange={(e) => setEleves((actuels) => actuels.map((v, i) => i === index ? { ...v, nom: e.target.value } : v))} /></td></tr>)}</tbody></table></div>
    {application.etat === "erreur" ? <p role="alert" className="mt-4 text-[color:var(--color-erreur)]">{application.message}</p> : null}
    <button className="bouton bouton-primaire mt-5" disabled={applicationEnCours}>{applicationEnCours ? "Création…" : "Confirmer et préparer les comptes"}</button>
  </form>;
}
