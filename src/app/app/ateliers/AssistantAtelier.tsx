"use client";

import Link from "next/link";
import { useActionState, useState } from "react";
import { BoutonEnvoi, Champ, Liste, RetourFormulaire, ZoneTexte, type EtatFormulaire } from "@/components/study/formulaire";
import { enregistrerEtape } from "./actions";

interface Source {
  titre: string;
  auteur: string;
  date: string;
  url: string;
  extrait: string;
}

export interface DonneesAtelier {
  readonly id: string | null;
  readonly kind: "actualite" | "verifier_ia";
  readonly titre: string;
  readonly question: string;
  readonly consigne: string;
  readonly texte: string;
  readonly sources: readonly Source[];
  readonly corrige: string;
  readonly cours: string | null;
}

const ETAPES = ["Objectif", "Sources datées", "Consignes", "Corrigé et publication"] as const;

/**
 * T05 — Assistant d'atelier en quatre étapes. Le brouillon est enregistré à
 * chaque étape (on peut quitter et reprendre). La publication rend l'atelier
 * visible aux élèves du cours choisi à l'étape 1 ; la base refuse une
 * publication sans sources datées suffisantes ou sans texte à examiner.
 */
export function AssistantAtelier({ etape, donnees, espaces }: { etape: number; donnees: DonneesAtelier; espaces: readonly { id: string; libelle: string }[] }) {
  const [etat, action] = useActionState<EtatFormulaire, FormData>(enregistrerEtape.bind(null, donnees.id, etape), {});
  const v = etat.valeurs ?? {};
  const [kind, setKind] = useState(donnees.kind);
  const [sources, setSources] = useState<Source[]>(donnees.sources.length ? [...donnees.sources] : [{ titre: "", auteur: "", date: "", url: "", extrait: "" }]);
  const lienEtape = (n: number) => (donnees.id ? `/app/prof/ateliers/${donnees.id}/assistant?etape=${n}` : null);

  return (
    <div className="grid gap-6">
      <ol className="m-0 grid list-none gap-2 p-0 sm:grid-cols-4" aria-label="Étapes de l'assistant">
        {ETAPES.map((libelle, i) => {
          const n = i + 1;
          const courant = n === etape;
          const href = lienEtape(n);
          const contenu = (
            <>
              <span className={`grid size-7 shrink-0 place-items-center rounded-full text-[0.8125rem] font-bold ${courant ? "bg-[color:var(--color-accent)] text-white" : n < etape ? "bg-[color:var(--color-rose-clair)] text-[color:var(--color-accent)]" : "border border-[color:var(--color-bordure)]"}`}>
                {n}
              </span>
              <span className={courant ? "font-semibold" : ""}>{libelle}</span>
            </>
          );
          return (
            <li key={libelle} aria-current={courant ? "step" : undefined}>
              {href && !courant ? (
                <Link href={href} className="flex items-center gap-2 no-underline">
                  {contenu}
                </Link>
              ) : (
                <span className="flex items-center gap-2">{contenu}</span>
              )}
            </li>
          );
        })}
      </ol>

      <form action={action} noValidate className="panneau">
        <RetourFormulaire etat={etat} />
        {etape === 1 ? (
          <>
            {donnees.id ? (
              <p className="meta m-0 mb-4">
                {kind === "actualite" ? "Actualité : faits, interprétations, opinions" : "Vérifier une réponse d'IA"} · {donnees.cours ?? "Cours"}
              </p>
            ) : (
              <>
                <Liste
                  libelle="Type d'atelier"
                  nom="kind"
                  valeur={kind}
                  onChange={(e) => setKind(e.target.value as DonneesAtelier["kind"])}
                  options={[
                    { valeur: "actualite", libelle: "Actualité : faits, interprétations, opinions" },
                    { valeur: "verifier_ia", libelle: "Vérifier une réponse d'IA avec les documents" },
                  ]}
                />
                <Liste libelle="Cours et classe destinataires" nom="espace" erreurs={etat.champs?.espace} options={[{ valeur: "", libelle: "Choisir…" }, ...espaces.map((e) => ({ valeur: e.id, libelle: e.libelle }))]} />
              </>
            )}
            <Champ libelle="Titre" nom="titre" requis maxLength={140} valeur={v.titre ?? donnees.titre} erreurs={etat.champs?.titre} />
            <ZoneTexte libelle="Question posée" nom="question" requis lignes={3} maxLength={1000} valeur={v.question ?? donnees.question} erreurs={etat.champs?.question} aide="Ce que les élèves devront établir à partir des documents." />
          </>
        ) : null}

        {etape === 2 ? (
          <>
            {kind === "verifier_ia" ? (
              <ZoneTexte
                libelle="Réponse proposée à examiner"
                nom="texte"
                requis
                lignes={7}
                maxLength={8000}
                valeur={v.texte ?? donnees.texte}
                erreurs={etat.champs?.texte}
                aide="Un texte choisi par vous (par exemple produit par un outil d'IA). Les élèves l'annotent : étayé, à vérifier, contredit — avec une justification tirée des documents. Study ne génère pas ce texte et ne prétend pas détecter un texte « écrit par IA »."
              />
            ) : null}
            <fieldset className="m-0 border-0 p-0">
              <legend className="mb-2 text-[0.875rem] font-semibold">{kind === "actualite" ? "Documents datés (2 à 5)" : "Documents de référence"}</legend>
              {etat.champs?.sources ? <p role="alert" className="m-0 mb-2 text-[0.875rem] text-[color:var(--color-erreur)]">{etat.champs.sources.join(" ")}</p> : null}
              {sources.map((s, i) => (
                <div key={i} className="mb-3 grid gap-2 rounded-[12px] border border-[color:var(--color-bordure)] p-3 sm:grid-cols-2">
                  <input name="source_titre" className="champ" placeholder="Titre du document" defaultValue={s.titre} aria-label={`Document ${i + 1} : titre`} />
                  <input name="source_auteur" className="champ" placeholder="Auteur, média ou institution" defaultValue={s.auteur} aria-label={`Document ${i + 1} : auteur`} />
                  <input name="source_date" type="date" className="champ" defaultValue={s.date} aria-label={`Document ${i + 1} : date`} required />
                  <input name="source_url" type="url" className="champ" placeholder="https://…" defaultValue={s.url} aria-label={`Document ${i + 1} : lien`} />
                  <textarea name="source_extrait" className="champ sm:col-span-2" rows={3} placeholder="Extrait cité" defaultValue={s.extrait} aria-label={`Document ${i + 1} : extrait`} />
                  {sources.length > 1 ? (
                    <button type="button" className="bouton bouton-discret bouton-compact w-fit" onClick={() => setSources((x) => x.filter((_, j) => j !== i))}>
                      Retirer ce document
                    </button>
                  ) : null}
                </div>
              ))}
              {sources.length < 5 ? (
                <button type="button" className="bouton bouton-secondaire bouton-compact" onClick={() => setSources((x) => [...x, { titre: "", auteur: "", date: "", url: "", extrait: "" }])}>
                  Ajouter un document
                </button>
              ) : null}
            </fieldset>
          </>
        ) : null}

        {etape === 3 ? (
          <ZoneTexte
            libelle="Consignes et pistes d'analyse"
            nom="consigne"
            lignes={8}
            maxLength={4000}
            valeur={v.consigne ?? donnees.consigne}
            aide="Par exemple : repérez les idées qui s'appuient directement sur un document ; relevez ce qui n'y figure pas ; proposez une réponse plus juste."
          />
        ) : null}

        {etape === 4 ? (
          <>
            <ZoneTexte libelle="Corrigé (visible des élèves après la clôture)" nom="corrige" lignes={6} maxLength={8000} valeur={v.corrige ?? donnees.corrige} />
            <div className="mb-4 rounded-[12px] bg-[color:var(--color-surface-douce)] p-4 text-[0.875rem]">
              <p className="m-0 font-semibold">Relecture</p>
              <ul className="m-0 mt-1 grid gap-1 pl-5">
                <li>Destinataires : les élèves de {donnees.cours ?? "ce cours"}.</li>
                <li>
                  {donnees.sources.length} document{donnees.sources.length > 1 ? "s" : ""} daté{donnees.sources.length > 1 ? "s" : ""}
                  {kind === "actualite" && (donnees.sources.length < 2 || donnees.sources.length > 5) ? " — il en faut 2 à 5 pour publier" : ""}.
                </li>
                {kind === "verifier_ia" ? <li>{donnees.texte ? "Réponse à examiner renseignée." : "Réponse à examiner manquante (étape 2)."}</li> : null}
              </ul>
            </div>
          </>
        ) : null}

        <div className="mt-2 flex flex-wrap gap-2">
          {etape > 1 && lienEtape(etape - 1) ? (
            <Link href={lienEtape(etape - 1)!} className="bouton bouton-discret">
              Étape précédente
            </Link>
          ) : null}
          {etape < 4 ? (
            <BoutonEnvoi enCours="Enregistrement…">Enregistrer et continuer</BoutonEnvoi>
          ) : (
            <>
              <BoutonEnvoi variante="secondaire" enCours="Enregistrement…" name="intention" value="brouillon">
                Enregistrer le brouillon
              </BoutonEnvoi>
              <BoutonEnvoi enCours="Publication…" name="intention" value="publier">
                Publier l&apos;atelier
              </BoutonEnvoi>
            </>
          )}
        </div>
      </form>
    </div>
  );
}
