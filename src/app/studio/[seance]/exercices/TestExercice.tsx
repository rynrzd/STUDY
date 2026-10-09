"use client";

import { useId, useState } from "react";
import { lireExercice, testerReponse } from "@/lib/revision/validation-exercice";

export type ExerciceATester = ReturnType<typeof lireExercice>;

/** Réservé au formulaire professeur ; aucune tentative n'est envoyée. */
export function TestExercice({ exercice }: { exercice: ExerciceATester }) {
  const id = useId();
  const [reponse, setReponse] = useState("");
  const [verifie, setVerifie] = useState(false);
  const [indice, setIndice] = useState(false);
  const v = exercice.valeurs;
  const resultat = testerReponse(exercice.bonne, reponse);
  return (
    <section aria-labelledby={`${id}-titre`} className="mt-5 border-t border-[color:var(--color-bordure)] pt-5">
      <h3 id={`${id}-titre`} className="m-0 text-lg font-bold">Tester avant de publier</h3>
      <p className="meta mt-2">Simulation professeur : rien n’est enregistré. Après une modification, relancez le test pour actualiser cet aperçu.</p>
      {!exercice.valide ? <div role="alert"><p className="font-semibold">Complétez l’exercice pour le tester :</p><ul className="list-disc pl-5">{Object.entries(exercice.champs).map(([champ, erreurs]) => <li key={champ}>{erreurs.join(" ")}</li>)}</ul></div> : <>
        <p className="whitespace-pre-wrap font-semibold">{v.enonce}</p>
        {v.kind === "qcm" ? <fieldset className="grid gap-2"><legend className="meta mb-2">Choisissez une réponse</legend>{exercice.choix.map((c, i) => <label key={i} className="flex min-h-11 items-center gap-3 rounded-lg border border-[color:var(--color-bordure)] p-3"><input type="radio" name={`${id}-reponse`} value={i} checked={reponse === String(i)} onChange={() => { setReponse(String(i)); setVerifie(false); }} /><span>{c}</span></label>)}</fieldset> : <div><label htmlFor={`${id}-reponse`} className="etiquette">Votre réponse</label>{v.kind === "texte" ? <textarea id={`${id}-reponse`} className="champ" value={reponse} maxLength={4000} onChange={(e) => { setReponse(e.target.value); setVerifie(false); }} /> : <input id={`${id}-reponse`} className="champ" inputMode="decimal" value={reponse} onChange={(e) => { setReponse(e.target.value); setVerifie(false); }} />}</div>}
        {v.indice && <><button type="button" aria-expanded={indice} className="bouton bouton-discret mt-3" onClick={() => setIndice(!indice)}>{indice ? "Masquer l’indice" : "Voir l’indice"}</button>{indice && <p className="whitespace-pre-wrap border-l-2 border-[color:var(--color-accent)] pl-3">{v.indice}</p>}</>}
        <button type="button" className="bouton bouton-secondaire mt-4" disabled={!reponse.trim()} onClick={() => setVerifie(true)}>{v.kind === "texte" ? "Voir l’explication" : "Vérifier ma réponse"}</button>
        {verifie && <div role="status" className="mt-4 rounded-lg bg-[color:var(--color-rose-clair)] p-4"><p className="m-0 font-bold">{v.kind === "texte" ? "Réponse rédigée : aucune note automatique." : resultat === null ? "Saisissez un nombre valide." : resultat ? "Bonne réponse." : "À reprendre."}</p>{(v.kind === "texte" || resultat !== null) && <><p className="whitespace-pre-wrap">{v.explication}</p>{v.exemple && <details><summary className="cursor-pointer font-semibold">Voir l’exemple complémentaire</summary><p className="whitespace-pre-wrap">{v.exemple}</p></details>}</>}</div>}
      </>}
    </section>
  );
}
