"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  ajouterQuestion,
  creerEvaluation,
  definirAmenagement,
  deposerPhoto,
  enregistrerReglages,
  importerExercices,
  noter,
  type EtatAction,
} from "@/app/professeur/evaluations/actions";
import { GENRES_QUESTION, LIBELLES_GENRE, type GenreQuestion } from "@/lib/evaluations/sujet";

/**
 * Formulaires du professeur. Chacun appelle une action serveur qui revérifie
 * tout ; ici on ne fait que guider la saisie et dire ce qui s'est passé.
 */

const etiquette = "mb-1.5 block text-[0.8125rem] font-semibold";

function Retour({ etat }: { etat: EtatAction | null }) {
  if (!etat) return null;
  return (
    <p role={etat.ok ? "status" : "alert"} className={`m-0 mt-3 text-[0.875rem] font-semibold ${etat.ok ? "text-[color:var(--color-succes)]" : "text-[color:var(--color-erreur)]"}`}>
      {etat.message}
    </p>
  );
}

function Envoyer({ libelle, enCours, ton = "primaire" }: { libelle: string; enCours: string; ton?: "primaire" | "secondaire" }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className={`bouton bouton-${ton}`} disabled={pending}>
      {pending ? enCours : libelle}
    </button>
  );
}

/* -------------------------------------------------------------------------- */

export function FormulaireNouvelle({ cours }: { cours: readonly { id: string; libelle: string }[] }) {
  const [etat, action] = useActionState(creerEvaluation, null);
  return (
    <form action={action} className="grid gap-4 sm:grid-cols-2">
      <div className="sm:col-span-2">
        <label htmlFor="ev-titre" className={etiquette}>
          Titre
        </label>
        <input id="ev-titre" name="titre" className="champ" required minLength={3} maxLength={140} placeholder="Contrôle — fonctions affines" />
      </div>
      <div>
        <label htmlFor="ev-cours" className={etiquette}>
          Classe et matière
        </label>
        <select id="ev-cours" name="cours" className="champ" required>
          {cours.map((c) => (
            <option key={c.id} value={c.id}>
              {c.libelle}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label htmlFor="ev-mode" className={etiquette}>
          Type
        </label>
        <select id="ev-mode" name="mode" className="champ" defaultValue="classe">
          <option value="classe">Contrôle en classe (55 min)</option>
          <option value="flash">Éval flash (5 min)</option>
          <option value="diagnostique">Diagnostique (20 min)</option>
          <option value="maison">À la maison (sans minuteur)</option>
        </select>
      </div>
      <fieldset className="m-0 border-0 p-0">
        <legend className={etiquette}>Support</legend>
        <label className="mr-4 inline-flex items-center gap-2">
          <input type="radio" name="support" value="en_ligne" defaultChecked /> En ligne
        </label>
        <label className="inline-flex items-center gap-2">
          <input type="radio" name="support" value="papier" /> Sur papier
        </label>
      </fieldset>
      <div>
        <label htmlFor="ev-notation" className={etiquette}>
          Résultats exprimés
        </label>
        <select id="ev-notation" name="notation" className="champ" defaultValue="les_deux">
          <option value="les_deux">Note sur 20 et niveaux de maîtrise</option>
          <option value="sur20">Note sur 20</option>
          <option value="maitrise">Niveaux de maîtrise seulement</option>
        </select>
      </div>
      <div className="sm:col-span-2">
        <Envoyer libelle="Créer l'évaluation" enCours="Création…" />
        <Retour etat={etat} />
      </div>
    </form>
  );
}

/* -------------------------------------------------------------------------- */

export function Reglages({
  evaluation,
  valeurs,
}: {
  evaluation: string;
  valeurs: { titre: string; consigne: string; ouvreLe: string; fermeLe: string; duree: number | null; melangerQuestions: boolean; melangerChoix: boolean; notation: string; papier: boolean };
}) {
  const [etat, action] = useActionState(enregistrerReglages, null);
  return (
    <form action={action} className="grid gap-4">
      <input type="hidden" name="evaluation" value={evaluation} />
      <div>
        <label htmlFor="r-titre" className={etiquette}>
          Titre
        </label>
        <input id="r-titre" name="titre" className="champ" defaultValue={valeurs.titre} required minLength={3} maxLength={140} />
      </div>
      <div>
        <label htmlFor="r-consigne" className={etiquette}>
          Consigne aux élèves <span className="font-normal text-[color:var(--color-encre-faible)]">(facultative)</span>
        </label>
        <textarea id="r-consigne" name="consigne" className="champ" rows={2} defaultValue={valeurs.consigne} maxLength={4000} />
      </div>
      {valeurs.papier ? (
        <>
          <input type="hidden" name="ouvre_le" value={valeurs.ouvreLe} />
          <input type="hidden" name="ferme_le" value={valeurs.fermeLe} />
          <input type="hidden" name="duree_minutes" value="" />
        </>
      ) : (
        <>
          <div>
            <label htmlFor="r-ouvre" className={etiquette}>
              Ouverture <span className="font-normal text-[color:var(--color-encre-faible)]">(heure de Paris)</span>
            </label>
            <input id="r-ouvre" name="ouvre_le" type="datetime-local" className="champ" defaultValue={valeurs.ouvreLe} />
          </div>
          <div>
            <label htmlFor="r-ferme" className={etiquette}>
              Fermeture
            </label>
            <input id="r-ferme" name="ferme_le" type="datetime-local" className="champ" defaultValue={valeurs.fermeLe} />
          </div>
          <div>
            <label htmlFor="r-duree" className={etiquette}>
              Durée par élève, en minutes <span className="font-normal text-[color:var(--color-encre-faible)]">(vide : jusqu&apos;à la fermeture)</span>
            </label>
            <input id="r-duree" name="duree_minutes" type="number" min={1} max={600} className="champ max-w-[160px]" defaultValue={valeurs.duree ?? ""} />
          </div>
        </>
      )}
      <div>
        <label htmlFor="r-notation" className={etiquette}>
          Résultats exprimés
        </label>
        <select id="r-notation" name="notation" className="champ" defaultValue={valeurs.notation}>
          <option value="les_deux">Note sur 20 et niveaux de maîtrise</option>
          <option value="sur20">Note sur 20</option>
          <option value="maitrise">Niveaux de maîtrise seulement</option>
        </select>
      </div>
      <fieldset className="m-0 grid gap-2 border-0 p-0">
        <legend className={etiquette}>Contre la copie entre voisins</legend>
        <label className="inline-flex items-center gap-2">
          <input type="checkbox" name="melanger_questions" defaultChecked={valeurs.melangerQuestions} /> Mélanger l&apos;ordre des questions pour chaque élève
        </label>
        <label className="inline-flex items-center gap-2">
          <input type="checkbox" name="melanger_choix" defaultChecked={valeurs.melangerChoix} /> Mélanger l&apos;ordre des choix des QCM
        </label>
      </fieldset>
      <div>
        <Envoyer libelle="Enregistrer les réglages" enCours="Enregistrement…" ton="secondaire" />
        <Retour etat={etat} />
      </div>
    </form>
  );
}

/* -------------------------------------------------------------------------- */

export function AjouterQuestion({ evaluation, notions }: { evaluation: string; notions: readonly { id: string; label: string }[] }) {
  const [etat, action] = useActionState(ajouterQuestion, null);
  const [kind, setKind] = useState<GenreQuestion>("qcm");
  const [choix, setChoix] = useState("");
  const lesChoix = choix.split("\n").map((c) => c.trim()).filter(Boolean);

  return (
    <form action={action} className="grid gap-4" key={etat?.ok ? etat.message : "formulaire"}>
      <input type="hidden" name="evaluation" value={evaluation} />
      <div className="grid gap-4 sm:grid-cols-3">
        <div>
          <label htmlFor="q-kind" className={etiquette}>
            Type de question
          </label>
          <select id="q-kind" name="kind" className="champ" value={kind} onChange={(e) => setKind(e.target.value as GenreQuestion)}>
            {GENRES_QUESTION.map((g) => (
              <option key={g} value={g}>
                {LIBELLES_GENRE[g]}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label htmlFor="q-points" className={etiquette}>
            Points
          </label>
          <input id="q-points" name="points" className="champ" inputMode="decimal" defaultValue="1" />
        </div>
        <div>
          <label htmlFor="q-notion" className={etiquette}>
            Notion évaluée
          </label>
          <select id="q-notion" name="notion" className="champ" defaultValue="">
            <option value="">Aucune</option>
            {notions.map((n) => (
              <option key={n.id} value={n.id}>
                {n.label}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <label htmlFor="q-enonce" className={etiquette}>
          Énoncé
        </label>
        <textarea id="q-enonce" name="enonce" className="champ" rows={3} required minLength={3} placeholder="Calcule f({c}) pour f(x) = {a}x + {b}." />
      </div>

      {kind === "qcm" || kind === "qcm_multiple" ? (
        <div>
          <label htmlFor="q-choix" className={etiquette}>
            Choix, un par ligne
          </label>
          <textarea id="q-choix" name="choix" className="champ" rows={4} value={choix} onChange={(e) => setChoix(e.target.value)} placeholder={"{a*c+b}\n{a+c+b}\n{a*c-b}"} />
          {lesChoix.length > 1 ? (
            <fieldset className="m-0 mt-2 grid gap-1 border-0 p-0">
              <legend className={etiquette}>{kind === "qcm" ? "La bonne réponse" : "Les bonnes réponses"}</legend>
              {lesChoix.map((c, i) => (
                <label key={`${i}-${c}`} className="inline-flex items-center gap-2">
                  <input type={kind === "qcm" ? "radio" : "checkbox"} name="bonne" value={i} defaultChecked={i === 0} /> {String.fromCharCode(65 + i)}. {c}
                </label>
              ))}
            </fieldset>
          ) : null}
        </div>
      ) : null}

      {kind === "vrai_faux" ? (
        <fieldset className="m-0 border-0 p-0">
          <legend className={etiquette}>L&apos;affirmation est</legend>
          <label className="mr-4 inline-flex items-center gap-2">
            <input type="radio" name="vrai" value="vrai" defaultChecked /> Vraie
          </label>
          <label className="inline-flex items-center gap-2">
            <input type="radio" name="vrai" value="faux" /> Fausse
          </label>
        </fieldset>
      ) : null}

      {kind === "numerique" ? (
        <div className="grid gap-4 sm:grid-cols-2">
          <div>
            <label htmlFor="q-valeur" className={etiquette}>
              Valeur attendue <span className="font-normal text-[color:var(--color-encre-faible)]">(ou formule : a*c+b)</span>
            </label>
            <input id="q-valeur" name="valeur" className="champ" required placeholder="7 ou a*c+b" />
          </div>
          <div>
            <label htmlFor="q-tolerance" className={etiquette}>
              Tolérance
            </label>
            <input id="q-tolerance" name="tolerance" className="champ max-w-[160px]" inputMode="decimal" defaultValue="0" />
          </div>
        </div>
      ) : null}

      {kind === "courte" ? (
        <div>
          <label htmlFor="q-acceptees" className={etiquette}>
            Réponses acceptées, une par ligne <span className="font-normal text-[color:var(--color-encre-faible)]">(casse, accents et espaces ignorés)</span>
          </label>
          <textarea id="q-acceptees" name="acceptees" className="champ" rows={2} required />
        </div>
      ) : null}

      {kind === "redigee" ? (
        <div>
          <label htmlFor="q-criteres" className={etiquette}>
            Critères de réussite <span className="font-normal text-[color:var(--color-encre-faible)]">(pour vous, à la correction)</span>
          </label>
          <textarea id="q-criteres" name="criteres" className="champ" rows={2} />
        </div>
      ) : null}

      <details className="rounded-[4px] border border-[color:var(--color-bordure)] p-3">
        <summary className="cursor-pointer font-semibold">Sujets différents par élève (valeurs aléatoires)</summary>
        <p className="meta m-0 mt-2">
          Écrivez {"{a}"}, {"{b}"}… dans l&apos;énoncé et les choix, ou un calcul comme {"{2*a+b}"}. Chaque élève reçoit ses propres valeurs.
        </p>
        <label htmlFor="q-parametres" className={`${etiquette} mt-3`}>
          Variables
        </label>
        <input id="q-parametres" name="parametres" className="champ" placeholder="a: 2..9 ; b: 1..9 ; c: -5..5 non nul" />
      </details>

      <div>
        <label htmlFor="q-explication" className={etiquette}>
          Explication montrée après publication <span className="font-normal text-[color:var(--color-encre-faible)]">(facultative)</span>
        </label>
        <textarea id="q-explication" name="explication" className="champ" rows={2} />
      </div>
      <div>
        <Envoyer libelle="Ajouter la question" enCours="Vérification…" />
        <Retour etat={etat} />
      </div>
    </form>
  );
}

/* -------------------------------------------------------------------------- */

export function ImporterBanque({ evaluation, exercices }: { evaluation: string; exercices: readonly { versionId: string; enonce: string; notion: string | null; kind: string }[] }) {
  const [etat, action] = useActionState(importerExercices, null);
  if (exercices.length === 0) return <p className="meta m-0">Aucun exercice publié dans la banque de ce cours.</p>;
  return (
    <form action={action}>
      <input type="hidden" name="evaluation" value={evaluation} />
      <ul className="m-0 grid max-h-[320px] list-none gap-1 overflow-auto p-0">
        {exercices.map((e) => (
          <li key={e.versionId}>
            <label className="flex items-start gap-3 rounded-[4px] p-2 hover:bg-[color:var(--color-survol)]">
              <input type="checkbox" name="version" value={e.versionId} className="mt-1" />
              <span className="min-w-0">
                <span className="line-clamp-2 block">{e.enonce}</span>
                <span className="meta block">
                  {e.kind === "qcm" ? "QCM" : e.kind === "numerique" ? "Numérique" : "Rédigée"}
                  {e.notion ? ` · ${e.notion}` : ""}
                </span>
              </span>
            </label>
          </li>
        ))}
      </ul>
      <div className="mt-3">
        <Envoyer libelle="Importer la sélection" enCours="Import…" ton="secondaire" />
        <Retour etat={etat} />
      </div>
    </form>
  );
}

/* -------------------------------------------------------------------------- */

/** Un bouton d'action sur l'évaluation (distribuer, publier), avec confirmation et retour. */
export function FormulaireAction({
  action: actionServeur,
  evaluation,
  libelle,
  enCours,
  confirmation,
  ton = "primaire",
}: {
  action: (e: EtatAction | null, d: FormData) => Promise<EtatAction>;
  evaluation: string;
  libelle: string;
  enCours: string;
  confirmation?: string;
  ton?: "primaire" | "secondaire";
}) {
  const [etat, action] = useActionState(actionServeur, null);
  return (
    <form
      action={action}
      onSubmit={(e) => {
        if (confirmation && !window.confirm(confirmation)) e.preventDefault();
      }}
    >
      <input type="hidden" name="evaluation" value={evaluation} />
      <Envoyer libelle={libelle} enCours={enCours} ton={ton} />
      <Retour etat={etat} />
    </form>
  );
}

/* -------------------------------------------------------------------------- */

export function NoteQuestion({
  evaluation,
  copie,
  question,
  maximum,
  points,
  commentaire,
  automatique,
}: {
  evaluation: string;
  copie: string;
  question: string;
  maximum: number;
  points: number | null;
  commentaire: string | null;
  automatique: boolean;
}) {
  const [etat, action] = useActionState(noter, null);
  return (
    <form action={action} className="flex flex-wrap items-end gap-2">
      <input type="hidden" name="evaluation" value={evaluation} />
      <input type="hidden" name="copie" value={copie} />
      <input type="hidden" name="question" value={question} />
      <label className="grid gap-1 text-[0.75rem] font-semibold">
        Points / {String(maximum).replace(".", ",")}
        <input name="points" className="champ w-[90px]" inputMode="decimal" defaultValue={points === null ? "" : String(points).replace(".", ",")} aria-label={`Points sur ${maximum}`} />
      </label>
      <label className="grid min-w-[180px] flex-1 gap-1 text-[0.75rem] font-semibold">
        Commentaire
        <input name="commentaire" className="champ" defaultValue={commentaire ?? ""} maxLength={2000} placeholder={automatique ? "Corrigé automatiquement" : ""} />
      </label>
      {[0, maximum / 2, maximum].map((v) => (
        <button
          key={v}
          type="submit"
          name="rapide"
          value={String(v)}
          className="bouton bouton-compact bouton-discret"
          title={`Mettre ${String(v).replace(".", ",")}`}
        >
          {String(v).replace(".", ",")}
        </button>
      ))}
      <Envoyer libelle="Enregistrer" enCours="…" ton="secondaire" />
      {etat ? (
        <span role={etat.ok ? "status" : "alert"} className={`text-[0.8125rem] font-semibold ${etat.ok ? "text-[color:var(--color-succes)]" : "text-[color:var(--color-erreur)]"}`}>
          {etat.message}
        </span>
      ) : null}
    </form>
  );
}

/* -------------------------------------------------------------------------- */

export function DeposerPhoto({ evaluation, copie }: { evaluation: string; copie: string }) {
  const [etat, action] = useActionState(deposerPhoto, null);
  return (
    <form action={action} className="flex flex-wrap items-center gap-2">
      <input type="hidden" name="evaluation" value={evaluation} />
      <input type="hidden" name="copie" value={copie} />
      <input type="file" name="photo" accept="image/jpeg,image/png,image/webp,image/heic,application/pdf" capture="environment" className="max-w-[220px] text-[0.8125rem]" aria-label="Photo de la copie" />
      <Envoyer libelle="Joindre" enCours="Envoi…" ton="secondaire" />
      {etat ? (
        <span role={etat.ok ? "status" : "alert"} className={`text-[0.8125rem] font-semibold ${etat.ok ? "text-[color:var(--color-succes)]" : "text-[color:var(--color-erreur)]"}`}>
          {etat.message}
        </span>
      ) : null}
    </form>
  );
}

export function ChoixAmenagement({ evaluation, eleve, valeur, figee }: { evaluation: string; eleve: string; valeur: number | null; figee: boolean }) {
  return (
    <form action={definirAmenagement}>
      <input type="hidden" name="evaluation" value={evaluation} />
      <input type="hidden" name="eleve" value={eleve} />
      <select
        name="coefficient"
        className="champ min-h-[36px] py-1 text-[0.8125rem]"
        defaultValue={valeur === null ? "" : String(valeur)}
        disabled={figee}
        aria-label="Temps majoré"
        onChange={(e) => e.currentTarget.form?.requestSubmit()}
      >
        <option value="">Temps normal</option>
        <option value="1.33">Tiers-temps (×1,33)</option>
        <option value="1.5">Temps ×1,5</option>
        <option value="2">Temps ×2</option>
      </select>
    </form>
  );
}
