"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { Archive, BookOpen, CircleAlert, CircleCheck, Link2, School } from "lucide-react";
import type { LucideIcon } from "lucide-react";
import {
  affecterUnProfesseur,
  creerSerieDeClasses,
  creerUneClasse,
  creerUneMatiere,
  fixerUneConservation,
} from "@/app/admin/actions";
import { ETAT_ADMIN_INITIAL, type EtatAdmin } from "@/app/admin/etats";

/**
 * Formulaires d'administration — cahier V2, §14.2 à §14.4.
 *
 * Tous suivent la même forme : un numéro d'étape, des champs courts, un seul
 * bouton, et une réponse écrite sous le formulaire. Aucun ne dépend de
 * JavaScript pour fonctionner — `useActionState` améliore l'expérience, il ne
 * la conditionne pas : sans JS, le navigateur poste et la page se recharge
 * avec le résultat.
 */

export interface Option {
  readonly id: string;
  readonly label: string;
}

/* ----------------------------------------------------------- Classes ----- */

export function FormulaireClasse() {
  const [etat, action] = useActionState<EtatAdmin, FormData>(creerUneClasse, ETAT_ADMIN_INITIAL);

  return (
    <form action={action} className="panneau flex flex-col">
      <EnTete numero={1} icone={School} titre="Nouvelle classe" texte="Le nom que verront les professeurs et les élèves. Créer deux fois la même classe ne la duplique pas." />
      <label className="etiquette mt-4" htmlFor="classe-label">
        Nom de la classe
      </label>
      <div className="flex flex-wrap gap-2">
        <input key={etat.saisie ?? "vide"} id="classe-label" name="label" type="text" className="champ min-w-0 flex-1" placeholder="Seconde 4" required maxLength={80} defaultValue={etat.saisie} />
        <Bouton libelle="Créer" />
      </div>
      <Retour etat={etat} />
      {etat.equivalente ? (
        <label className="mt-3 flex items-start gap-3 text-[0.9375rem]">
          <input type="checkbox" name="confirmer" value="oui" className="mt-1 size-4 shrink-0 accent-[color:var(--color-accent)]" />
          <span>
            Ce n&apos;est pas la même classe que « {etat.equivalente} » : créer « {etat.saisie} » quand même.
            <span className="aide-champ">Sinon, utilisez simplement « {etat.equivalente} » : rien n&apos;est à créer.</span>
          </span>
        </label>
      ) : null}
    </form>
  );
}

/* ---------------------------------------------------------- Matières ----- */

export function FormulaireMatiere() {
  const [etat, action] = useActionState<EtatAdmin, FormData>(creerUneMatiere, ETAT_ADMIN_INITIAL);

  return (
    <form action={action} className="panneau flex flex-col">
      <EnTete numero={2} icone={BookOpen} titre="Nouvelle matière" texte="Propres à votre établissement : vous gardez vos intitulés." />
      <label className="etiquette mt-4" htmlFor="matiere-label">
        Nom de la matière
      </label>
      <div className="flex flex-wrap gap-2">
        <input id="matiere-label" name="label" type="text" className="champ min-w-0 flex-1" placeholder="Mathématiques" required maxLength={80} />
        <Bouton libelle="Créer" />
      </div>
      <Retour etat={etat} />
    </form>
  );
}

/* ------------------------------------------------------- Affectation ----- */

export function FormulaireAffectation({
  professeurs,
  listeClasses,
  matieres,
}: {
  professeurs: readonly Option[];
  listeClasses: readonly Option[];
  matieres: readonly Option[];
}) {
  const [etat, action] = useActionState<EtatAdmin, FormData>(affecterUnProfesseur, ETAT_ADMIN_INITIAL);

  const manque = [
    professeurs.length === 0 ? "un professeur" : null,
    listeClasses.length === 0 ? "une classe" : null,
    matieres.length === 0 ? "une matière" : null,
  ].filter((x): x is string => x !== null);

  return (
    <form action={action} className="panneau">
      <EnTete
        numero={3}
        icone={Link2}
        titre="Affecter un professeur"
        texte="Un professeur, une classe, une matière : le cours apparaît dans « Mes cours » du professeur, et les séances publiées chez les élèves de la classe."
      />

      {manque.length > 0 ? (
        <p className="ajout-identifiant mt-4">
          Il manque encore {manque.join(", ").replace(/, ([^,]*)$/, " et $1")} pour créer une affectation.
        </p>
      ) : (
        <div className="mt-4 grid items-end gap-3 md:grid-cols-[1fr_1fr_1fr_auto]">
          <Choix nom="professeur" libelle="Professeur" options={professeurs} />
          <Choix nom="classe" libelle="Classe" options={listeClasses} />
          <Choix nom="matiere" libelle="Matière" options={matieres} />
          <Bouton libelle="Affecter" />
        </div>
      )}

      <Retour etat={etat} />
    </form>
  );
}

/* ------------------------------------------------ Conservation journal ----- */

const DUREES = [
  { mois: 12, libelle: "12 mois" },
  { mois: 36, libelle: "3 ans" },
  { mois: 60, libelle: "5 ans" },
] as const;

/** Durée de conservation du journal d'audit (risque R-07), à fixer avec le DPO. */
export function FormulaireConservation({ actuelle }: { actuelle: number | null }) {
  const [etat, action] = useActionState<EtatAdmin, FormData>(fixerUneConservation, ETAT_ADMIN_INITIAL);
  return (
    <form action={action} className="panneau">
      <div className="flex items-start gap-3">
        <span className="tuile" aria-hidden="true">
          <Archive size={20} strokeWidth={1.75} />
        </span>
        <div className="min-w-0">
          <h2 className="titre-bloc m-0 font-bold">Conservation du journal</h2>
          <p className="meta m-0 mt-1 max-w-[70ch]">
            Le journal trace les actes d&apos;administration (comptes créés, accès réinitialisés, affectations). Au-delà de cette durée, les lignes sont effacées
            chaque nuit. Choisissez-la avec le délégué à la protection des données de l&apos;établissement.
          </p>
        </div>
      </div>
      <fieldset className="mt-4 border-0 p-0">
        <legend className="sr-only">Durée de conservation</legend>
        <div className="flex flex-wrap items-center gap-2">
          {DUREES.map((d) => (
            <label key={d.mois} className="puce-cours cursor-pointer gap-2 py-2 text-[0.9375rem]">
              <input type="radio" name="mois" value={d.mois} defaultChecked={actuelle === d.mois} required />
              {d.libelle}
            </label>
          ))}
          <Bouton libelle="Enregistrer" />
        </div>
      </fieldset>
      <Retour etat={etat} />
    </form>
  );
}

/* -------------------------------------------------------------------------- */

function EnTete({ numero, icone: Icone, titre, texte }: { numero: number; icone: LucideIcon; titre: string; texte: string }) {
  return (
    <div className="flex items-start gap-3">
      <span className="tuile" aria-hidden="true">
        <Icone size={20} strokeWidth={1.75} />
      </span>
      <div className="min-w-0">
        <p className="meta m-0 font-semibold uppercase tracking-[0.06em]">Étape {numero}</p>
        <h2 className="titre-bloc m-0 font-bold">{titre}</h2>
        <p className="meta m-0 mt-1 max-w-[62ch]">{texte}</p>
      </div>
    </div>
  );
}

function Choix({
  nom,
  libelle,
  options,
}: {
  nom: string;
  libelle: string;
  options: readonly Option[];
}) {
  return (
    <div className="min-w-0">
      <label className="etiquette" htmlFor={`affectation-${nom}`}>
        {libelle}
      </label>
      <select id={`affectation-${nom}`} name={nom} className="champ" required defaultValue="">
        <option value="" disabled>
          Choisir…
        </option>
        {options.map((option) => (
          <option key={option.id} value={option.id}>
            {option.label}
          </option>
        ))}
      </select>
    </div>
  );
}

function Bouton({ libelle }: { libelle: string }) {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="bouton bouton-primaire">
      {pending ? "…" : libelle}
    </button>
  );
}

function Retour({ etat }: { etat: EtatAdmin }) {
  if (etat.etat === "vierge" || etat.message === undefined) return null;
  const ok = etat.etat === "ok";
  const Icone = ok ? CircleCheck : CircleAlert;
  return (
    <p
      role="status"
      className={`m-0 mt-3 flex items-center gap-2 rounded-[var(--rayon-m)] px-3.5 py-2.5 text-[0.9375rem] font-semibold ${
        ok ? "bg-[color:var(--color-succes-fond)] text-[color:var(--color-succes)]" : "bg-[color:var(--color-erreur-fond)] text-[color:var(--color-erreur)]"
      }`}
    >
      <Icone size={18} strokeWidth={1.75} aria-hidden="true" className="shrink-0" /> {etat.message}
    </p>
  );
}

/* ------------------------------------------- Classes en série (CL-10) ----- */

const plat = (v: string) => v.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase().replace(/\s+/g, "");
const cle = (v: string) => plat(v).replace(/^(seconde|2nde|2de)/, "2").replace(/^(premiere|1ere|1re)/, "1").replace(/^(terminale|term|tle)/, "t");

/** Créer « 2nde 1 » à « 2nde 8 » d'un coup, avec aperçu ; les équivalentes existantes sont sautées. */
export function FormulaireSerieClasses({ existantes }: { existantes: readonly string[] }) {
  const [prefixe, setPrefixe] = useState("");
  const [de, setDe] = useState(1);
  const [a, setA] = useState(4);
  const [etat, action] = useActionState<EtatAdmin, FormData>(creerSerieDeClasses, ETAT_ADMIN_INITIAL);
  const cles = new Set(existantes.map(cle));
  const libelles = prefixe.trim().length > 0 && a >= de && a - de < 40 ? Array.from({ length: a - de + 1 }, (_, i) => `${prefixe.trim()} ${de + i}`) : [];
  const nouveaux = libelles.filter((l) => !cles.has(cle(l)));

  return (
    <form action={action} className="panneau flex flex-col">
      <p className="m-0 font-bold">Plusieurs classes d&apos;un coup</p>
      <p className="meta m-0 mt-1">Un préfixe et une plage : « 2nde », de 1 à 8. Les classes déjà présentes sont sautées.</p>
      <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)_minmax(0,1fr)]">
        <div>
          <label className="etiquette" htmlFor="serie-prefixe">
            Préfixe
          </label>
          <input id="serie-prefixe" className="champ" value={prefixe} onChange={(e) => setPrefixe(e.target.value)} placeholder="2nde" maxLength={60} />
        </div>
        <div>
          <label className="etiquette" htmlFor="serie-de">
            De
          </label>
          <input id="serie-de" type="number" min={0} max={99} className="champ" value={de} onChange={(e) => setDe(Number(e.target.value) || 0)} />
        </div>
        <div>
          <label className="etiquette" htmlFor="serie-a">
            À
          </label>
          <input id="serie-a" type="number" min={0} max={99} className="champ" value={a} onChange={(e) => setA(Number(e.target.value) || 0)} />
        </div>
      </div>
      {libelles.length > 0 ? (
        <p className="m-0 mt-3 flex flex-wrap gap-1.5">
          {libelles.map((l) => (
            <span key={l} className="puce-cours" data-ton={cles.has(cle(l)) ? "attention" : undefined}>
              {l}
              {cles.has(cle(l)) ? " · déjà là" : ""}
            </span>
          ))}
        </p>
      ) : null}
      <input type="hidden" name="libelles" value={JSON.stringify(nouveaux)} />
      <div className="mt-3">
        <button type="submit" className="bouton bouton-secondaire" disabled={nouveaux.length === 0}>
          {nouveaux.length === 0 ? "Créer" : `Créer ${nouveaux.length} classe${nouveaux.length > 1 ? "s" : ""}`}
        </button>
      </div>
      <Retour etat={etat} />
    </form>
  );
}
