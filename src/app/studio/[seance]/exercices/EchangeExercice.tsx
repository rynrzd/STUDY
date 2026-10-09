"use client";
import { useId, useState } from "react";
import { exporterExercice, importerExercice, LIMITE_FICHIER_EXERCICE } from "@/lib/revision/echange-exercice";
import type { lireExercice } from "@/lib/revision/validation-exercice";

type Exercice = ReturnType<typeof lireExercice>;
export function EchangeExercice({ lire, appliquer, autoriserImport }: { lire: () => Exercice | null; appliquer: (e: Exercice) => void; autoriserImport: boolean }) {
  const id = useId();
  const [message, setMessage] = useState("");
  const [candidat, setCandidat] = useState<Exercice | null>(null);
  const [lecture, setLecture] = useState(false);
  function exporter() {
    try {
      const exercice = lire();
      if (!exercice) return;
      const url = URL.createObjectURL(new Blob([exporterExercice(exercice)], { type: "application/json" }));
      const lien = document.createElement("a"); lien.href = url; lien.download = "exercice-study.json"; lien.click();
      setTimeout(() => URL.revokeObjectURL(url), 1000);
      setMessage("Export préparé. Le fichier contient le corrigé : partagez-le uniquement avec des professeurs.");
    } catch (e) { setMessage(e instanceof Error ? e.message : "Export impossible."); }
  }
  return <details className="mb-5 border-b border-[color:var(--color-bordure)] pb-4"><summary className="cursor-pointer py-2 font-semibold">Importer ou exporter un exercice</summary>
    <p className="meta">Format Study (.json), 64 Ko maximum. Le corrigé est inclus. Aucun compte, résultat d’élève ou rattachement de classe n’est exporté.</p>
    <button type="button" className="bouton bouton-secondaire mb-3" onClick={exporter}>Exporter le formulaire</button>
    {autoriserImport ? <><label htmlFor={id} className="etiquette">Choisir un export Study</label><input id={id} type="file" accept=".json,application/json" disabled={lecture} className="champ" onChange={async (event) => {
      const fichier = event.currentTarget.files?.[0]; event.currentTarget.value = ""; setCandidat(null); setMessage("");
      if (!fichier) return;
      if (fichier.size > LIMITE_FICHIER_EXERCICE) { setMessage("Le fichier dépasse 64 Ko."); return; }
      setLecture(true);
      try { setCandidat(importerExercice(await fichier.text())); } catch (e) { setMessage(e instanceof Error ? e.message : "Import impossible."); } finally { setLecture(false); }
    }} />{lecture && <p role="status">Vérification du fichier…</p>}
    {candidat && <div className="mt-3 rounded-lg bg-[color:var(--color-rose-clair)] p-3"><p className="m-0 font-semibold">Exercice prêt à importer</p><p className="line-clamp-3 whitespace-pre-wrap">{candidat.valeurs.enonce}</p><p className="meta">Cette action remplace le contenu du formulaire. Rien n’est enregistré ni publié.</p><div className="flex flex-wrap gap-2"><button type="button" className="bouton bouton-secondaire" onClick={() => { appliquer(candidat); setCandidat(null); setMessage("Contenu importé dans le formulaire. Vérifiez-le avant de l’enregistrer."); }}>Remplacer le formulaire</button><button type="button" className="bouton bouton-discret" onClick={() => setCandidat(null)}>Annuler</button></div></div>}</> : <p className="meta">Pour importer un exercice, ouvrez le formulaire de nouvel exercice. Une version existante n’est pas remplacée par un import.</p>}
    {message && <p role="status" className="mt-3 text-sm">{message}</p>}
  </details>;
}
