"use client";

import { useActionState, useRef, useState } from "react";
import { BoutonEnvoi, Champ, Liste, RetourFormulaire, ZoneTexte, type EtatFormulaire } from "@/components/study/formulaire";
import { EchangeExercice } from "./EchangeExercice";
import { creerExercice } from "./actions";
import { lireExercice } from "@/lib/revision/validation-exercice";
import { TestExercice, type ExerciceATester } from "./TestExercice";

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
  const [importe, setImporte] = useState<{ valeurs: Record<string, string>; numero: number } | null>(null);
  const v = importe?.valeurs ?? etat.valeurs ?? {};
  const [kind, setKind] = useState(v.kind ?? base?.kind ?? "qcm");
  const [nbChoix, setNbChoix] = useState(Math.max(3, base?.choix.length ?? 0));
  const choix = (v.choix ?? base?.choix.join("\n") ?? "").split("\n");
  const formulaire = useRef<HTMLFormElement>(null);
  const [test, setTest] = useState<{ exercice: ExerciceATester; numero: number } | null>(null);

  return (
    <form action={action} ref={formulaire} key={importe?.numero ?? 0} className="min-w-0">
      <RetourFormulaire etat={etat} />
      {base ? <input type="hidden" name="exercice" value={base.exercice} /> : null}
      <fieldset className="mb-5 min-w-0">
        <legend className="mb-3 font-bold">1. Quel type de question ?</legend>
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-1 xl:grid-cols-2">
          {[
            { valeur: "qcm", titre: "QCM", description: "Plusieurs choix, une bonne réponse" },
            { valeur: "vrai_faux", titre: "Vrai ou faux", description: "Deux réponses possibles" },
            { valeur: "numerique", titre: "Un nombre", description: "Correction automatique" },
            { valeur: "texte", titre: "Réponse rédigée", description: "À lire par le professeur" },
          ].map((format) => (
            <label key={format.valeur} className={`flex min-h-20 cursor-pointer items-start gap-3 rounded-[var(--radius-carte)] border p-3 transition-colors ${kind === format.valeur ? "border-[color:var(--color-accent)] bg-[color:var(--color-rose-clair)]" : "border-[color:var(--color-bordure)] hover:border-[color:var(--color-bordure-forte)]"}`}>
              <input
                type="radio"
                name="format"
                value={format.valeur}
                checked={kind === format.valeur}
                onChange={() => { setKind(format.valeur); setTest(null); }}
                className="mt-1 h-4 w-4 shrink-0 accent-[color:var(--color-accent)]"
              />
              <span className="min-w-0">
                <span className="block font-semibold">{format.titre}</span>
                <span className="mt-0.5 block text-[length:var(--text-aide)] text-[color:var(--color-encre-faible)]">{format.description}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <input type="hidden" name="kind" value={kind === "vrai_faux" ? "qcm" : kind} />
      <h3 className="mb-3 text-base font-bold">2. Écris ta question et sa réponse</h3>
      <ZoneTexte libelle="Question posée aux élèves" nom="enonce" requis lignes={3} maxLength={4000} valeur={v.enonce ?? base?.enonce} erreurs={etat.champs?.enonce} placeholder="Ex. Quelle est la capitale de l'Italie ?" />
      {kind === "vrai_faux" ? (
        <fieldset className="mb-4">
          <legend className="mb-2 text-sm font-semibold">Quelle est la bonne réponse ?</legend>
          <input type="hidden" name="choix" value="Vrai" />
          <input type="hidden" name="choix" value="Faux" />
          <div className="grid grid-cols-2 gap-2">
            {[{ valeur: "1", titre: "Vrai" }, { valeur: "2", titre: "Faux" }].map((option) => (
              <label key={option.valeur} className="flex min-h-12 cursor-pointer items-center gap-2 rounded-[var(--radius-carte)] border border-[color:var(--color-bordure)] p-3">
                <input type="radio" name="bonne" value={option.valeur} defaultChecked={(v.bonne ?? "1") === option.valeur} required className="h-4 w-4 accent-[color:var(--color-accent)]" />
                {option.titre}
              </label>
            ))}
          </div>
        </fieldset>
      ) : kind === "qcm" ? (
        <fieldset className="mb-4">
          <legend className="mb-2 text-sm font-semibold">Propose les réponses et coche la bonne</legend>
          <p className="m-0 mb-3 text-[length:var(--text-aide)] text-[color:var(--color-encre-faible)]">
            Écris au moins deux réponses différentes. La bonne sera utilisée pour la correction.
          </p>
          {Array.from({ length: nbChoix }, (_, i) => (
            <div key={i} className="mb-2 flex min-w-0 items-center gap-2 rounded-[var(--radius-carte)] border border-[color:var(--color-bordure)] p-2">
              <input type="radio" name="bonne" value={String(i + 1)} defaultChecked={v.bonne === String(i + 1)} required aria-label={`La réponse ${i + 1} est correcte`} className="h-5 w-5 shrink-0 accent-[color:var(--color-accent)]" />
              <label className="sr-only" htmlFor={`choix-${i}`}>
                Réponse possible {i + 1}
              </label>
              <input id={`choix-${i}`} name="choix" className="champ min-w-0 flex-1" defaultValue={choix[i] ?? ""} maxLength={300} placeholder={`Réponse ${i + 1}`} />
            </div>
          ))}
          {nbChoix < 8 ? (
            <button type="button" className="bouton bouton-discret bouton-compact" onClick={() => setNbChoix((n) => n + 1)}>
              Ajouter un choix
            </button>
          ) : null}
          {etat.champs?.choix ? <p className="m-0 mt-1 text-[0.8125rem] text-[color:var(--color-erreur)]">{etat.champs.choix.join(" ")}</p> : null}
          {etat.champs?.bonne ? <p className="m-0 mt-2 text-[0.8125rem] text-[color:var(--color-erreur)]">{etat.champs.bonne.join(" ")}</p> : null}
        </fieldset>
      ) : kind === "numerique" ? (
        <div className="grid gap-x-3 sm:grid-cols-2">
          <Champ libelle="Nombre attendu" nom="bonne" requis inputMode="decimal" valeur={v.bonne} aide="Tu peux utiliser une virgule ou un point." erreurs={etat.champs?.bonne} />
          <Champ libelle="Tolérance" nom="tolerance" inputMode="decimal" valeur={v.tolerance ?? "0"} aide="Écart accepté (0 = valeur exacte)." erreurs={etat.champs?.tolerance} />
        </div>
      ) : <p className="m-0 mb-4 text-[length:var(--text-aide)] text-[color:var(--color-encre-faible)]">Les élèves rédigent librement leur réponse. Elle n&apos;est pas corrigée automatiquement.</p>}

      <h3 className="mb-3 text-base font-bold">3. Aide les élèves à comprendre</h3>
      <ZoneTexte libelle="Explication de la réponse" nom="explication" requis lignes={3} maxLength={4000} valeur={v.explication} erreurs={etat.champs?.explication} aide="Affichée après leur réponse, même quand ils se trompent." placeholder="Ex. Rome est la capitale de l'Italie. Milan est une grande ville du nord." />

      <details className="mb-5 rounded-[var(--radius-carte)] border border-[color:var(--color-bordure)] p-3" open={Boolean(etat.champs?.indice || etat.champs?.exemple || etat.champs?.nouvelle_notion) || undefined}>
        <summary className="cursor-pointer font-semibold">Pour aller plus loin (facultatif)</summary>
        <p className="meta m-0 mt-2 mb-3">Ajoute un indice, un exemple similaire ou la notion à retravailler. Tu pourras aussi le faire plus tard.</p>
        <ZoneTexte libelle="Indice pour débloquer l'élève" nom="indice" lignes={2} maxLength={2000} valeur={v.indice} />
        <ZoneTexte libelle="Exemple similaire" nom="exemple" lignes={2} maxLength={4000} valeur={v.exemple} />
        <div className="grid gap-x-3 sm:grid-cols-2">
          <Liste
            libelle="Notion associée"
            nom="notion"
            requis={false}
            valeur={v.notion ?? base?.notion ?? ""}
            options={[{ valeur: "", libelle: "Aucune / nouvelle notion" }, ...notions.map((n) => ({ valeur: n.id, libelle: n.label }))]}
          />
          <Champ libelle="Nouvelle notion" nom="nouvelle_notion" maxLength={120} valeur={v.nouvelleNotion} aide="Pour les révisions proposées aux élèves." />
        </div>
      </details>

      <button type="button" className="bouton bouton-secondaire mb-4 w-full sm:w-auto" onClick={() => {
        if (!formulaire.current) return;
        const exercice = lireExercice(new FormData(formulaire.current));
        setTest((precedent) => ({ exercice, numero: (precedent?.numero ?? 0) + 1 }));
      }}>Voir ce que l&apos;élève verra</button>
      {test && <TestExercice key={test.numero} exercice={test.exercice} />}

      <div className="flex flex-col gap-2 sm:flex-row sm:flex-wrap">
        <BoutonEnvoi className="w-full sm:w-auto" enCours="Enregistrement…">
          Enregistrer en brouillon
        </BoutonEnvoi>
        <BoutonEnvoi name="publier" value="oui" variante="secondaire" className="w-full sm:w-auto" enCours="Publication…">
          {base ? "Publier cette version" : "Publier maintenant"}
        </BoutonEnvoi>
      </div>
      <p className="meta m-0 mt-2">En brouillon, l&apos;exercice est invisible pour les élèves.</p>

      <div className="mt-5 border-t border-[color:var(--color-bordure)] pt-4">
        <EchangeExercice autoriserImport={!base} lire={() => formulaire.current ? lireExercice(new FormData(formulaire.current)) : null} appliquer={(e) => {
          setKind(e.valeurs.kind);
          setNbChoix(Math.max(3, e.choix.length));
          setTest(null);
          setImporte((precedent) => ({ valeurs: e.valeurs, numero: (precedent?.numero ?? 0) + 1 }));
        }} />
      </div>
    </form>
  );
}
