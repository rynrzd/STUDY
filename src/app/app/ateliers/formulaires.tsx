"use client";

import { useActionState, useState } from "react";
import { BoutonEnvoi, Champ, Liste, RetourFormulaire, ZoneTexte, type EtatFormulaire } from "@/components/study/formulaire";
import { enregistrerAtelier, publierSynthese, repondreAtelier } from "./actions";

interface Source {
  titre: string;
  auteur: string;
  date: string;
  url: string;
  extrait: string;
}

export function FormulaireAtelier({
  atelier,
  espaces,
  initial,
}: {
  atelier: string | null;
  espaces: readonly { id: string; libelle: string }[];
  initial?: { kind: string; titre: string; question: string; consigne: string; texte: string; sources: Source[]; corrige: string };
}) {
  const [etat, action] = useActionState<EtatFormulaire, FormData>(enregistrerAtelier.bind(null, atelier), {});
  const v = etat.valeurs ?? {};
  const [kind, setKind] = useState(v.kind ?? initial?.kind ?? "actualite");
  const [sources, setSources] = useState<Source[]>(initial?.sources.length ? initial.sources : [{ titre: "", auteur: "", date: "", url: "", extrait: "" }]);
  return (
    <form action={action}>
      <RetourFormulaire etat={etat} />
      {atelier ? <input type="hidden" name="kind" value={kind} /> : (
        <>
          <Liste
            libelle="Type d'atelier"
            nom="kind"
            valeur={kind}
            onChange={(e) => setKind(e.target.value)}
            options={[
              { valeur: "actualite", libelle: "Actualité : faits, interprétations, opinions" },
              { valeur: "verifier_ia", libelle: "Vérifier une réponse d'IA" },
            ]}
          />
          <Liste libelle="Cours" nom="espace" erreurs={etat.champs?.espace} options={[{ valeur: "", libelle: "Choisir…" }, ...espaces.map((e) => ({ valeur: e.id, libelle: e.libelle }))]} />
        </>
      )}
      <Champ libelle="Titre" nom="titre" requis maxLength={140} valeur={v.titre ?? initial?.titre} erreurs={etat.champs?.titre} />
      <ZoneTexte libelle="Question centrale" nom="question" requis lignes={2} maxLength={1000} valeur={v.question ?? initial?.question} erreurs={etat.champs?.question} />
      <ZoneTexte libelle="Consigne" nom="consigne" lignes={2} maxLength={4000} valeur={v.consigne ?? initial?.consigne} />
      {kind === "verifier_ia" ? (
        <ZoneTexte
          libelle="Texte d'exemple à vérifier"
          nom="texte"
          lignes={6}
          maxLength={8000}
          valeur={v.texte ?? initial?.texte}
          aide="Un texte que vous avez choisi. Les élèves annotent : étayé, à vérifier, contredit — avec une justification. Aucun outil ne prétend détecter un texte « écrit par IA »."
        />
      ) : null}
      <fieldset className="mb-4">
        <legend className="mb-2 text-[0.8125rem] font-semibold">{kind === "actualite" ? "Sources datées (2 à 5)" : "Sources du cours"}</legend>
        {etat.champs?.sources ? <p className="m-0 mb-2 text-[0.8125rem] text-[color:var(--color-erreur)]">{etat.champs.sources.join(" ")}</p> : null}
        {sources.map((s, i) => (
          <div key={i} className="mb-3 grid gap-2 rounded-[10px] border border-[color:var(--color-bordure)] p-3 sm:grid-cols-2">
            <input name="source_titre" className="champ" placeholder="Titre" defaultValue={s.titre} aria-label={`Source ${i + 1} : titre`} />
            <input name="source_auteur" className="champ" placeholder="Auteur ou média" defaultValue={s.auteur} aria-label={`Source ${i + 1} : auteur`} />
            <input name="source_date" type="date" className="champ" defaultValue={s.date} aria-label={`Source ${i + 1} : date`} />
            <input name="source_url" type="url" className="champ" placeholder="https://…" defaultValue={s.url} aria-label={`Source ${i + 1} : lien`} />
            <textarea name="source_extrait" className="champ sm:col-span-2" rows={2} placeholder="Extrait" defaultValue={s.extrait} aria-label={`Source ${i + 1} : extrait`} />
          </div>
        ))}
        {sources.length < 5 ? (
          <button type="button" className="bouton bouton-discret bouton-compact" onClick={() => setSources((x) => [...x, { titre: "", auteur: "", date: "", url: "", extrait: "" }])}>
            Ajouter une source
          </button>
        ) : null}
      </fieldset>
      <ZoneTexte libelle="Corrigé (visible des élèves après la clôture)" nom="corrige" lignes={3} maxLength={8000} valeur={v.corrige ?? initial?.corrige} />
      <BoutonEnvoi enCours="Enregistrement…">Enregistrer le brouillon</BoutonEnvoi>
    </form>
  );
}

export function FormulaireSyntheseAtelier({ atelier, synthese }: { atelier: string; synthese: string }) {
  const [etat, action] = useActionState<EtatFormulaire, FormData>(publierSynthese.bind(null, atelier), {});
  return (
    <form action={action}>
      <RetourFormulaire etat={etat} />
      <ZoneTexte libelle="Synthèse pour la classe" nom="synthese" lignes={5} maxLength={8000} valeur={etat.valeurs?.synthese ?? synthese} />
      <BoutonEnvoi variante="secondaire" enCours="Enregistrement…">
        Enregistrer la synthèse
      </BoutonEnvoi>
    </form>
  );
}

const CATEGORIES = {
  actualite: [
    { valeur: "fait", libelle: "Fait vérifiable" },
    { valeur: "interpretation", libelle: "Interprétation" },
    { valeur: "opinion", libelle: "Opinion" },
  ],
  verifier_ia: [
    { valeur: "etaye", libelle: "Étayé par le cours" },
    { valeur: "a_verifier", libelle: "À vérifier" },
    { valeur: "contredit", libelle: "Contredit par le cours" },
  ],
} as const;

export function FormulaireReponseAtelier({
  atelier,
  kind,
  version,
  clos,
  sources,
  initiales,
}: {
  atelier: string;
  kind: "actualite" | "verifier_ia";
  version: number;
  clos: boolean;
  sources: readonly { titre: string }[];
  initiales: { passage: string; categorie: string; justification: string; source: number | null }[];
}) {
  const [etat, action] = useActionState<EtatFormulaire, FormData>(repondreAtelier.bind(null, atelier, version), {});
  const [lignes, setLignes] = useState(initiales.length > 0 ? initiales : [{ passage: "", categorie: "", justification: "", source: null }]);
  return (
    <form action={action}>
      <RetourFormulaire etat={etat} />
      {!clos
        ? lignes.map((l, i) => (
            <fieldset key={i} className="mb-4 rounded-[10px] border border-[color:var(--color-bordure)] p-3">
              <legend className="px-1 text-[0.8125rem] font-semibold">Annotation {i + 1}</legend>
              <label className="mb-1 block text-[0.8125rem]" htmlFor={`passage-${i}`}>
                {kind === "actualite" ? "Affirmation relevée" : "Passage du texte"}
              </label>
              <textarea id={`passage-${i}`} name="passage" className="champ mb-2" rows={2} defaultValue={l.passage} maxLength={1000} />
              <div className="grid gap-2 sm:grid-cols-2">
                <select name="categorie" className="champ" defaultValue={l.categorie} aria-label="Catégorie">
                  <option value="">Catégorie…</option>
                  {CATEGORIES[kind].map((c) => (
                    <option key={c.valeur} value={c.valeur}>
                      {c.libelle}
                    </option>
                  ))}
                </select>
                <select name="source" className="champ" defaultValue={l.source === null ? "" : String(l.source)} aria-label="Source citée">
                  <option value="">Source citée…</option>
                  {sources.map((s, k) => (
                    <option key={k} value={k}>
                      {s.titre}
                    </option>
                  ))}
                </select>
              </div>
              <label className="mb-1 mt-2 block text-[0.8125rem]" htmlFor={`just-${i}`}>
                Justification
              </label>
              <textarea id={`just-${i}`} name="justification" className="champ" rows={2} defaultValue={l.justification} maxLength={2000} />
            </fieldset>
          ))
        : null}
      {!clos && lignes.length < 30 ? (
        <button type="button" className="bouton bouton-discret bouton-compact mb-4" onClick={() => setLignes((x) => [...x, { passage: "", categorie: "", justification: "", source: null }])}>
          Ajouter une annotation
        </button>
      ) : null}
      {clos ? (
        <ZoneTexte libelle="Contester le corrigé (argumenté)" nom="contestation" lignes={3} maxLength={2000} aide="Le désaccord est possible : il est lu par ton professeur, il n'est jamais noté." />
      ) : null}
      <BoutonEnvoi enCours="Envoi…">{clos ? "Envoyer ma contestation" : "Enregistrer ma réponse"}</BoutonEnvoi>
    </form>
  );
}
