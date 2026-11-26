"use client";

import Link from "next/link";
import { BookOpenText, FileText, FileUp, PenLine } from "lucide-react";
import { MODELES_LECON } from "@/lib/modeles-lecon";
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
  const [modele, setModele] = useState<keyof typeof MODELES_LECON>("vide");
  const [etat, action] = useActionState<EtatStudio, FormData>(creerSeance, ETAT_STUDIO_INITIAL);
  const routeur = useRouter();

  // Créer puis ouvrir : c'est la séance qu'on veut voir, pas la liste.
  useEffect(() => {
    if (etat.etat === "ok" && etat.cree) routeur.push(`/studio/${etat.cree}`);
  }, [etat, routeur]);

  if (!ouvert && menu) {
    return (
      <div data-testid="ajouter-lecon" className="grid min-w-0 gap-3 md:grid-cols-3">
        <button
          type="button"
          data-testid="ouvrir-nouvelle-seance"
          className="group flex min-w-0 flex-col items-start gap-2 rounded-2xl border border-[color:var(--color-accent)] bg-white p-4 text-left transition-colors hover:bg-[color:var(--color-rose-clair)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-accent)] sm:p-5"
          onClick={() => { setMode("ecrire"); setOuvert(true); }}
        >
          <span className="grid size-10 place-items-center rounded-xl bg-[color:var(--color-rose-clair)] text-[color:var(--color-accent)]"><PenLine size={21} aria-hidden="true" /></span>
          <span className="text-base font-bold">Écrire ma séance</span>
          <span className="text-sm leading-6 text-[color:var(--color-encre-faible)]">Partir d’une page vide ou d’un modèle, puis ajouter cours et exercices.</span>
          <span className="mt-auto pt-2 text-sm font-bold text-[color:var(--color-accent)]">Commencer</span>
        </button>
        <button
          type="button"
          className="flex min-w-0 flex-col items-start gap-2 rounded-2xl border border-[color:var(--color-bordure)] bg-white p-4 text-left transition-colors hover:border-[color:var(--color-accent)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-accent)] sm:p-5"
          onClick={() => { setMode("pdf"); setOuvert(true); }}
        >
          <span className="grid size-10 place-items-center rounded-xl bg-[color:var(--color-rose-clair)] text-[color:var(--color-accent)]"><FileText size={21} aria-hidden="true" /></span>
          <span className="text-base font-bold">Utiliser mon PDF</span>
          <span className="text-sm leading-6 text-[color:var(--color-encre-faible)]">Garder le document intact. Tu l’ajouteras après avoir ouvert la séance.</span>
          <span className="mt-auto pt-2 text-sm font-bold text-[color:var(--color-accent)]">Commencer</span>
        </button>
        <Link
          href="/professeur/studio#depot"
          className="flex min-w-0 flex-col items-start gap-2 rounded-2xl border border-[color:var(--color-bordure)] bg-white p-4 text-left no-underline transition-colors hover:border-[color:var(--color-accent)] focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[color:var(--color-accent)] sm:p-5"
        >
          <span className="grid size-10 place-items-center rounded-xl bg-[color:var(--color-rose-clair)] text-[color:var(--color-accent)]"><FileUp size={21} aria-hidden="true" /></span>
          <span className="text-base font-bold">Transformer un document</span>
          <span className="text-sm leading-6 text-[color:var(--color-encre-faible)]">Importer un Word ou PDF pour en récupérer le texte modifiable.</span>
          <span className="mt-auto pt-2 text-sm font-bold text-[color:var(--color-accent)]">Importer</span>
        </Link>
      </div>
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
      className="w-full min-w-0 rounded-2xl border border-[color:var(--color-bordure)] bg-white p-4 sm:p-6"
    >
      <input type="hidden" name="cours" value={cours} />
      <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="m-0 mb-1 text-xs font-bold uppercase tracking-[0.12em] text-[color:var(--color-accent)]">Préparer le brouillon</p>
          <h3 className="m-0 text-xl font-bold">{mode === "pdf" ? "Une séance avec ton PDF" : "Ta nouvelle séance"}</h3>
          <p className="m-0 mt-2 text-sm leading-6 text-[color:var(--color-encre-faible)]">
            {mode === "pdf"
              ? "Commence par lui donner un nom. Tu ajouteras ton PDF tel quel dans l'éditeur à l'étape suivante."
              : "Commence par un titre. Le contenu se prépare ensuite, tranquillement, dans l'éditeur."}
          </p>
        </div>
        <button type="button" onClick={() => setOuvert(false)} className="bouton bouton-discret bouton-compact shrink-0">Changer de choix</button>
      </div>

      <div className="min-w-0">
        <label className="etiquette" htmlFor={`titre-${cours}`}>Quel est le sujet de la séance ?</label>
        <input
          id={`titre-${cours}`}
          data-testid="seance-titre"
          name="titre"
          type="text"
          className="champ min-w-0"
          placeholder="Ex. Les suites géométriques"
          required
          maxLength={160}
        />
        <p className="aide-champ">Un titre court suffit. Tu pourras toujours le modifier après.</p>
      </div>

      {mode === "ecrire" ? (
        <div className="mt-5 min-w-0">
          <label className="etiquette" htmlFor={`modele-${cours}`}>Comment veux-tu commencer ?</label>
          <select id={`modele-${cours}`} name="modele" className="champ min-w-0" value={modele} onChange={(e) => setModele(e.target.value as keyof typeof MODELES_LECON)}>
            {Object.entries(MODELES_LECON).map(([valeur, modeleLecon]) => (
              <option key={valeur} value={valeur}>{modeleLecon.libelle}</option>
            ))}
          </select>
          <div className="mt-2 flex items-start gap-2 rounded-xl bg-[color:var(--color-rose-clair)] p-3 text-sm leading-6 text-[color:var(--color-encre-faible)]">
            <BookOpenText size={19} className="mt-0.5 shrink-0 text-[color:var(--color-accent)]" aria-hidden="true" />
            <p className="m-0">{modele === "vide" ? "Une page libre, à remplir comme tu veux." : "Le modèle prépare seulement des rubriques à compléter. Rien n'est publié ni inventé automatiquement."}</p>
          </div>
        </div>
      ) : null}

      <details className="mt-5 rounded-xl border border-[color:var(--color-bordure)] p-4">
        <summary className="cursor-pointer text-sm font-bold text-[color:var(--color-accent)]">Date et rangement (facultatif)</summary>
        <div className="mt-4 grid min-w-0 gap-4 sm:grid-cols-2">
          <div className="min-w-0">
            <label className="etiquette" htmlFor={`date-${cours}`}>Date prévue</label>
            <input id={`date-${cours}`} data-testid="seance-date" name="date" type="date" className="champ min-w-0" />
          </div>
          {chapitres.length > 0 ? (
            <div className="min-w-0">
              <label className="etiquette" htmlFor={`chapitre-${cours}`}>Chapitre</label>
              <select id={`chapitre-${cours}`} data-testid="seance-chapitre" name="chapitre" className="champ min-w-0" defaultValue={chapitreParDefaut ?? ""}>
                <option value="">Sans chapitre</option>
                {chapitres.map((chapitre) => <option key={chapitre.id} value={chapitre.id}>{chapitre.label}</option>)}
              </select>
            </div>
          ) : null}
        </div>
      </details>

      <div className="mt-5 flex flex-col-reverse gap-2 sm:flex-row sm:items-center">
        <button type="button" onClick={() => setOuvert(false)} className="bouton bouton-discret w-full sm:w-auto">Annuler</button>
        <Bouton libelle="Créer mon brouillon" marque="seance-valider" />
      </div>
      <p className="aide-champ m-0 mt-3">Personne ne verra la séance avant que tu décides de la publier.</p>
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
      className="min-w-0 rounded-xl border border-[color:var(--color-bordure)] bg-white p-4"
    >
      <h2 className="titre-bloc m-0 font-bold">
        Nouveau chapitre
      </h2>
      <p className="m-0 mt-2 text-[length:var(--text-aide)] leading-[var(--text-aide--line-height)] text-[color:var(--color-encre-faible)]">
        Les chapitres rangent les séances. Ils suivent en général votre
        progression de l&apos;année.
      </p>

      <input type="hidden" name="cours" value={cours} />

      <label className="etiquette mt-4" htmlFor={`chapitre-nouveau-${cours}`}>Nom du chapitre</label>
      <input
        id={`chapitre-nouveau-${cours}`}
        data-testid="chapitre-label"
        name="label"
        type="text"
        className="champ min-w-0"
        placeholder="Ex. Chapitre 4 — Suites"
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
      className={`bouton bouton-rose min-w-0 whitespace-normal py-3 text-center leading-5 ${pleineLargeur ? "mt-3 w-full" : "w-full sm:w-auto"}`}
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
