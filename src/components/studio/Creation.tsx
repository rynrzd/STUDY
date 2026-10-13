"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import { creerChapitre, creerSeance } from "@/app/studio/actions";
import { ETAT_STUDIO_INITIAL, type EtatStudio } from "@/app/studio/etats";

/**
 * Création d'un chapitre et d'une séance — cahier V2, §9.2 et §9.3.
 *
 * Les champs sont réduits au strict minimum : un titre, une date, un chapitre.
 * Le reste se remplit dans l'éditeur, une fois la séance ouverte. Le cahier est
 * explicite : on crée, puis on ouvre immédiatement — pas de formulaire
 * gigantesque avant d'avoir rien écrit.
 */

export function NouvelleSeance({
  cours,
  chapitres,
  chapitreParDefaut = null,
  compact = false,
  menu = false,
}: {
  cours: string;
  chapitres: { id: string; label: string }[];
  chapitreParDefaut?: string | null;
  compact?: boolean;
  /**
   * Une seule entrée « Ajouter une leçon » et ses trois modes (cahier des
   * charges ch. 10, TEACH-03) : écrire, mettre un PDF tel quel, importer pour
   * transformer. Rien ne part sans choix explicite.
   */
  menu?: boolean;
}) {
  const [ouvert, setOuvert] = useState(false);
  const [mode, setMode] = useState<"ecrire" | "pdf">("ecrire");
  const [etat, action] = useActionState<EtatStudio, FormData>(creerSeance, ETAT_STUDIO_INITIAL);
  const routeur = useRouter();

  // Créer puis ouvrir : c'est la séance qu'on veut voir, pas la liste.
  useEffect(() => {
    if (etat.etat === "ok" && etat.cree) routeur.push(`/studio/${etat.cree}`);
  }, [etat, routeur]);

  if (!ouvert && menu) {
    return (
      <details className="menu-deroulant ajouter-lecon">
        <summary data-testid="ajouter-lecon" className="bouton bouton-rose">
          + Ajouter
        </summary>
        <div className="menu-deroulant-panneau right-0 mt-2 w-[320px] max-w-[calc(100vw-32px)]">
          <button
            type="button"
            data-testid="ouvrir-nouvelle-seance"
            className="choix-lecon"
            onClick={() => {
              setMode("ecrire");
              setOuvert(true);
            }}
          >
            <span className="font-semibold">Écrire une séance</span>
            <span className="meta">Texte, liens, exercices, devoirs</span>
          </button>
          <button
            type="button"
            className="choix-lecon"
            onClick={() => {
              setMode("pdf");
              setOuvert(true);
            }}
          >
            <span className="font-semibold">Mettre un PDF tel quel</span>
            <span className="meta">Formules et mise en page intactes</span>
          </button>
          <Link href="/professeur/studio#depot" className="choix-lecon">
            <span className="font-semibold">Importer pour le transformer</span>
            <span className="meta">Word ou PDF converti en séance modifiable, à relire</span>
          </Link>
          <hr className="my-1 border-0 border-t border-[color:var(--color-bordure)]" />
          <a href="#nouveau-chapitre" className="choix-lecon">
            <span className="font-semibold">Nouveau chapitre</span>
            <span className="meta">Pour ranger les séances de ce cours</span>
          </a>
          <Link href="/studio/exercices" className="choix-lecon">
            <span className="font-semibold">Un exercice</span>
            <span className="meta">Depuis la banque, à ajouter dans une séance</span>
          </Link>
          <Link href="/professeur/devoirs#donner" className="choix-lecon">
            <span className="font-semibold">Un devoir</span>
            <span className="meta">Avec échéance, rendu en ligne ou sur papier</span>
          </Link>
        </div>
      </details>
    );
  }

  if (!ouvert) {
    return (
      <button
        type="button"
        data-testid="ouvrir-nouvelle-seance"
        onClick={() => setOuvert(true)}
        className={`bouton ${compact ? "bouton-discret bouton-compact" : "bouton-rose"}`}
      >
        + Nouvelle séance
      </button>
    );
  }

  return (
    <form
      action={action}
      data-testid="seance-nouvelle"
      className="bloc border border-[color:var(--color-bordure)] p-4"
    >
      <input type="hidden" name="cours" value={cours} />

      {mode === "pdf" ? (
        <p className="meta m-0 mb-3">
          Donnez un titre à la séance : une fois créée, ajoutez votre PDF avec le bloc « Document ». Il reste tel quel, lu sur place par vos élèves.
        </p>
      ) : null}

      <div className="grid gap-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
        <div>
          <label className="etiquette" htmlFor={`titre-${cours}`}>
            Titre de la séance
          </label>
          <input
            id={`titre-${cours}`}
            data-testid="seance-titre"
            name="titre"
            type="text"
            className="champ"
            placeholder="Suites géométriques"
            required
            autoFocus
            maxLength={160}
          />
        </div>

        <div>
          <label className="etiquette" htmlFor={`date-${cours}`}>
            Date
          </label>
          <input
            id={`date-${cours}`}
            data-testid="seance-date"
            name="date"
            type="date"
            className="champ"
          />
        </div>
      </div>

      {chapitres.length > 0 ? (
        <div className="mt-3">
          <label className="etiquette" htmlFor={`chapitre-${cours}`}>
            Chapitre
          </label>
          <select
            id={`chapitre-${cours}`}
            data-testid="seance-chapitre"
            name="chapitre"
            className="champ"
            defaultValue={chapitreParDefaut ?? ""}
          >
            <option value="">Sans chapitre</option>
            {chapitres.map((chapitre) => (
              <option key={chapitre.id} value={chapitre.id}>
                {chapitre.label}
              </option>
            ))}
          </select>
        </div>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-2">
        <Bouton libelle="Créer et ouvrir" marque="seance-valider" />
        <button type="button" onClick={() => setOuvert(false)} className="bouton bouton-discret">
          Annuler
        </button>
      </div>

      <Retour etat={etat} />
    </form>
  );
}

export function NouveauChapitre({ cours }: { cours: string }) {
  const [etat, action] = useActionState<EtatStudio, FormData>(creerChapitre, ETAT_STUDIO_INITIAL);

  return (
    <form
      action={action}
      data-testid="chapitre-nouveau"
      className="bloc border border-[color:var(--color-bordure)] p-4"
    >
      <h2 className="titre-bloc m-0 font-bold">
        Nouveau chapitre
      </h2>
      <p className="m-0 mt-2 text-[length:var(--text-aide)] leading-[var(--text-aide--line-height)] text-[color:var(--color-encre-faible)]">
        Les chapitres rangent les séances. Ils suivent en général votre
        progression de l&apos;année.
      </p>

      <input type="hidden" name="cours" value={cours} />

      <label className="sr-only" htmlFor={`chapitre-nouveau-${cours}`}>
        Titre du chapitre
      </label>
      <input
        id={`chapitre-nouveau-${cours}`}
        data-testid="chapitre-label"
        name="label"
        type="text"
        className="champ mt-3"
        placeholder="Chapitre 4 — Suites"
        required
        maxLength={120}
      />

      <Bouton libelle="Ajouter" pleineLargeur marque="chapitre-valider" />
      <Retour etat={etat} />
    </form>
  );
}

/* -------------------------------------------------------------------------- */

function Bouton({
  libelle,
  pleineLargeur = false,
  marque,
}: {
  libelle: string;
  pleineLargeur?: boolean;
  /** Identifiant stable pour la recette : « Ajouter » ne distingue rien. */
  marque?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      data-testid={marque}
      disabled={pending}
      className={`bouton bouton-rose ${pleineLargeur ? "mt-3 w-full" : ""}`}
    >
      {pending ? "…" : libelle}
    </button>
  );
}

function Retour({ etat }: { etat: EtatStudio }) {
  if (etat.etat === "vierge" || !etat.message) return null;
  return (
    <p
      role="status"
      className={`m-0 mt-3 text-[length:var(--text-aide)] ${
        etat.etat === "ok"
          ? "text-[color:var(--color-succes)]"
          : "text-[color:var(--color-erreur)]"
      }`}
    >
      {etat.message}
    </p>
  );
}
