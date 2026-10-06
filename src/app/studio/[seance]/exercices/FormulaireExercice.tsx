"use client";

import { useActionState, useMemo, useState } from "react";
import { BoutonEnvoi, Champ, Liste, RetourFormulaire, ZoneTexte, type EtatFormulaire } from "@/components/study/formulaire";
import { creerExercice } from "./actions";

export function FormulaireExercice({
  seance,
  notions,
  base,
}: {
  seance: string;
  notions: readonly { id: string; label: string }[];
  /** Pour créer la version suivante d'un exercice existant. */
  base?: { exercice: string; kind: string; enonce: string; choix: readonly string[]; notion: string | null };
}) {
  const [etat, action] = useActionState<EtatFormulaire, FormData>(creerExercice.bind(null, seance), {});
  const v = etat.valeurs ?? {};
  const [kind, setKind] = useState(v.kind ?? base?.kind ?? "qcm");
  const [nbChoix, setNbChoix] = useState(Math.max(3, base?.choix.length ?? 0));
  const choix = (v.choix ?? base?.choix.join("\n") ?? "").split("\n");
  const cle = useMemo(() => (etat.ok ? crypto.randomUUID() : "saisie"), [etat]);

  return (
    <form action={action} key={cle}>
      <RetourFormulaire etat={etat} />
      {base ? <input type="hidden" name="exercice" value={base.exercice} /> : null}
      <Liste
        libelle="Type"
        nom="kind"
        valeur={kind}
        onChange={(e) => setKind(e.target.value)}
        options={[
          { valeur: "qcm", libelle: "Choix multiple (corrigé automatiquement)" },
          { valeur: "numerique", libelle: "Réponse numérique (corrigée automatiquement)" },
          { valeur: "texte", libelle: "Réponse rédigée (pas de correction automatique)" },
        ]}
      />
      <ZoneTexte libelle="Énoncé" nom="enonce" requis lignes={3} maxLength={4000} valeur={v.enonce ?? base?.enonce} erreurs={etat.champs?.enonce} />
      {kind === "qcm" ? (
        <fieldset className="mb-4">
          <legend className="mb-2 text-[0.8125rem] font-semibold">Choix</legend>
          {Array.from({ length: nbChoix }, (_, i) => (
            <div key={i} className="mb-2 flex items-center gap-2">
              <span className="meta w-6">{i + 1}.</span>
              <label className="sr-only" htmlFor={`choix-${i}`}>
                Choix {i + 1}
              </label>
              <input id={`choix-${i}`} name="choix" className="champ" defaultValue={choix[i] ?? ""} maxLength={300} />
            </div>
          ))}
          {nbChoix < 8 ? (
            <button type="button" className="bouton bouton-discret bouton-compact" onClick={() => setNbChoix((n) => n + 1)}>
              Ajouter un choix
            </button>
          ) : null}
          {etat.champs?.choix ? <p className="m-0 mt-1 text-[0.8125rem] text-[color:var(--color-erreur)]">{etat.champs.choix.join(" ")}</p> : null}
          <Champ libelle="Numéro du bon choix" nom="bonne" requis type="number" min={1} max={8} valeur={v.bonne} erreurs={etat.champs?.bonne} />
        </fieldset>
      ) : kind === "numerique" ? (
        <div className="grid gap-x-3 sm:grid-cols-2">
          <Champ libelle="Bonne réponse" nom="bonne" requis inputMode="decimal" valeur={v.bonne} erreurs={etat.champs?.bonne} />
          <Champ libelle="Tolérance" nom="tolerance" inputMode="decimal" valeur={v.tolerance ?? "0"} aide="Écart accepté (0 = valeur exacte)." />
        </div>
      ) : null}
      <ZoneTexte libelle="Explication (montrée après la réponse)" nom="explication" requis lignes={3} maxLength={4000} valeur={v.explication} erreurs={etat.champs?.explication} />
      <ZoneTexte libelle="Indice (Débloque-moi, étape 2)" nom="indice" lignes={2} maxLength={2000} valeur={v.indice} />
      <ZoneTexte libelle="Exemple proche (Débloque-moi, étape 3)" nom="exemple" lignes={2} maxLength={4000} valeur={v.exemple} />
      <div className="grid gap-x-3 sm:grid-cols-2">
        <Liste
          libelle="Notion"
          nom="notion"
          requis={false}
          valeur={v.notion ?? base?.notion ?? ""}
          options={[{ valeur: "", libelle: "Aucune / nouvelle notion" }, ...notions.map((n) => ({ valeur: n.id, libelle: n.label }))]}
        />
        <Champ libelle="Nouvelle notion" nom="nouvelle_notion" maxLength={120} valeur={v.nouvelleNotion} aide="Sert aux révisions proposées aux élèves." />
      </div>
      <div className="flex flex-wrap gap-2">
        <BoutonEnvoi name="publier" value="oui" enCours="Publication…">
          {base ? "Publier la nouvelle version" : "Publier l'exercice"}
        </BoutonEnvoi>
        <BoutonEnvoi variante="secondaire" enCours="Enregistrement…">
          Garder en brouillon
        </BoutonEnvoi>
      </div>
    </form>
  );
}
