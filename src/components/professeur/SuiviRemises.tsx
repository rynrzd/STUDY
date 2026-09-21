"use client";

import { useActionState, useId, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  constaterRemisePapier,
  enregistrerUneCorrection,
  retirerUneCorrection,
} from "@/app/professeur/devoirs/actions";
import { ETAT_DEVOIR_INITIAL, type EtatDevoirAction } from "@/app/professeur/devoirs/etats";
import { instantLisible } from "@/lib/horodatage";

/**
 * Le suivi d'un devoir, élève par élève — cahier V5, §4 et §5.
 *
 * Deux principes.
 *
 * **La liste part des élèves, pas des copies.** Un élève qui n'a rien rendu
 * doit apparaître : sinon « non remis » se confondrait avec « pas dans la
 * classe », et le professeur ne verrait jamais celui qui a décroché.
 *
 * **La correction naît en brouillon.** Le professeur écrit, relit, puis
 * publie. Tant qu'il n'a pas publié, l'élève ne sait même pas qu'un retour
 * existe — ce qui laisse le droit de se raviser.
 */

export interface LigneEleve {
  readonly eleve: string;
  readonly prenom: string;
  readonly nom: string;
  readonly etat: string;
  readonly nombreVersions: number;
  readonly derniere: {
    readonly id: string;
    readonly numero: number;
    readonly remisLe: string;
    readonly enRetard: boolean;
    readonly fichier: string | null;
    readonly nomFichier: string | null;
    readonly reference: string;
    readonly estLaDerniere: boolean;
  } | null;
  readonly retour: {
    readonly id: string;
    readonly commentaire: string | null;
    readonly publieLe: string | null;
  } | null;
}

const ETIQUETTES: Record<string, string> = {
  non_commence: "Non remis",
  brouillon: "Non remis",
  remis: "Remis",
  remis_en_retard: "Remis en retard",
  retour_disponible: "Corrigé",
  a_reprendre: "À reprendre",
};

export function SuiviRemises({
  devoir,
  organisation,
  mode,
  lignes,
}: {
  devoir: string;
  organisation: string;
  mode: string;
  lignes: readonly LigneEleve[];
}) {
  const [filtre, setFiltre] = useState<"tous" | "remis" | "non_remis" | "corriges">("tous");
  const [recherche, setRecherche] = useState("");
  // Trois tris, et ils répondent à trois questions réelles : « où en est la
  // classe » (nom), « qui n'a rien rendu » (état), « qui a rendu au dernier
  // moment » (heure). Un tri par note n'existe pas : il n'y a pas de note.
  const [tri, setTri] = useState<"nom" | "etat" | "heure">("nom");
  const champRecherche = useId();
  const champTri = useId();

  const papier = mode === "papier" || mode === "mixte";

  const compte = {
    total: lignes.length,
    remis: lignes.filter((l) => l.etat === "remis").length,
    retard: lignes.filter((l) => l.etat === "remis_en_retard").length,
    corriges: lignes.filter((l) => l.retour?.publieLe != null).length,
  };
  const nonRemis = compte.total - compte.remis - compte.retard;

  const visibles = lignes.filter((ligne) => {
    const remis = ligne.etat === "remis" || ligne.etat === "remis_en_retard";
    if (filtre === "remis" && !remis) return false;
    if (filtre === "non_remis" && remis) return false;
    if (filtre === "corriges" && ligne.retour?.publieLe == null) return false;

    if (recherche.trim() === "") return true;
    const cible = `${ligne.prenom} ${ligne.nom}`.toLowerCase();
    return cible.includes(recherche.trim().toLowerCase());
  });

  // Le tri porte sur ce qui est déjà filtré, et il est stable : deux élèves à
  // égalité restent dans l'ordre alphabétique, faute de quoi la liste bouge
  // entre deux affichages sans que rien n'ait changé.
  const RANG_ETAT: Record<string, number> = {
    non_commence: 0,
    brouillon: 0,
    remis_en_retard: 1,
    remis: 2,
    retour_disponible: 3,
    a_reprendre: 3,
  };

  const parNom = (a: LigneEleve, b: LigneEleve) =>
    a.nom.localeCompare(b.nom, "fr") || a.prenom.localeCompare(b.prenom, "fr");

  const ordonnees = [...visibles].sort((a, b) => {
    if (tri === "etat") {
      return (RANG_ETAT[a.etat] ?? 9) - (RANG_ETAT[b.etat] ?? 9) || parNom(a, b);
    }
    if (tri === "heure") {
      // Ceux qui n'ont rien rendu passent en dernier : trier par une heure
      // qu'ils n'ont pas les placerait arbitrairement au début.
      const quand = (ligne: LigneEleve) => ligne.derniere?.remisLe ?? "";
      if (quand(a) === "") return quand(b) === "" ? parNom(a, b) : 1;
      if (quand(b) === "") return -1;
      return quand(b).localeCompare(quand(a)) || parNom(a, b);
    }
    return parNom(a, b);
  });

  return (
    <section className="mt-10" data-testid="suivi-remises">
      <h2 className="m-0 text-[length:var(--text-h2-app)] leading-[var(--text-h2-app--line-height)]">
        Remises
      </h2>

      <dl
        data-testid="suivi-compteurs"
        className="m-0 mt-4 flex flex-wrap gap-x-8 gap-y-2 text-[length:var(--text-tableau)]"
      >
        {[
          ["Élèves", compte.total, "total"],
          ["Non remis", nonRemis, "non-remis"],
          ["Remis", compte.remis, "remis"],
          ["En retard", compte.retard, "retard"],
          ["Corrigés", compte.corriges, "corriges"],
        ].map(([libelle, valeur, cle]) => (
          <div key={String(cle)}>
            <dt className="m-0 text-[length:var(--text-aide)] text-[color:var(--color-encre-faible)]">
              {libelle}
            </dt>
            <dd className="m-0 text-[1.25rem] font-bold" data-testid={`compteur-${cle}`}>
              {valeur}
            </dd>
          </div>
        ))}
      </dl>

      <div className="mt-5 flex flex-wrap items-end gap-3 print:hidden">
        <div className="min-w-[9rem]">
          <label className="etiquette" htmlFor={champTri}>
            Trier par
          </label>
          <select
            id={champTri}
            data-testid="suivi-tri"
            value={tri}
            onChange={(evenement) => setTri(evenement.target.value as typeof tri)}
            className="champ"
          >
            <option value="nom">Nom</option>
            <option value="etat">État</option>
            <option value="heure">Heure de remise</option>
          </select>
        </div>

        <div className="min-w-[12rem] flex-1">
          <label className="etiquette" htmlFor={champRecherche}>
            Rechercher un élève
          </label>
          <input
            id={champRecherche}
            data-testid="suivi-recherche"
            type="search"
            value={recherche}
            onChange={(evenement) => setRecherche(evenement.target.value)}
            className="champ"
            placeholder="Nom ou prénom"
          />
        </div>

        <div className="flex flex-wrap gap-2">
          {[
            ["tous", "Tous"],
            ["non_remis", "Non remis"],
            ["remis", "Remis"],
            ["corriges", "Corrigés"],
          ].map(([valeur, libelle]) => (
            <button
              key={valeur}
              type="button"
              data-testid={`filtre-${valeur}`}
              aria-pressed={filtre === valeur}
              onClick={() => setFiltre(valeur as typeof filtre)}
              className={`bouton bouton-compact ${
                filtre === valeur ? "bouton-primaire" : "bouton-secondaire"
              }`}
            >
              {libelle}
            </button>
          ))}
        </div>
      </div>

      {ordonnees.length === 0 ? (
        <p
          data-testid="suivi-vide"
          className="m-0 mt-5 rounded-[var(--radius-carte)] border border-dashed border-[color:var(--color-bordure-forte)] p-6 text-center text-[color:var(--color-encre-faible)]"
        >
          {lignes.length === 0
            ? "Aucun élève n'est inscrit dans cette classe."
            : "Aucun élève ne correspond à ce filtre."}
        </p>
      ) : (
        <ul className="m-0 mt-5 list-none space-y-3 p-0">
          {ordonnees.map((ligne) => (
            <li key={ligne.eleve}>
              <LigneSuivi
                ligne={ligne}
                devoir={devoir}
                organisation={organisation}
                papier={papier}
              />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

/* -------------------------------------------------------------------------- */

function LigneSuivi({
  ligne,
  devoir,
  organisation,
  papier,
}: {
  ligne: LigneEleve;
  devoir: string;
  organisation: string;
  papier: boolean;
}) {
  const [ouvert, setOuvert] = useState(false);

  return (
    <article
      data-testid="suivi-ligne"
      data-eleve={ligne.eleve}
      data-etat={ligne.etat}
      className="rounded-[var(--radius-carte)] border border-[color:var(--color-bordure)] p-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="min-w-0">
          <p className="m-0 font-semibold">
            {ligne.prenom} {ligne.nom}
          </p>
          <p className="m-0 text-[length:var(--text-aide)] text-[color:var(--color-encre-faible)]">
            {ETIQUETTES[ligne.etat] ?? "Non remis"}
            {ligne.derniere !== null
              ? ` — ${instantLisible(ligne.derniere.remisLe)}${
                  ligne.nombreVersions > 1 ? ` (version ${ligne.derniere.numero})` : ""
                }`
              : ""}
            {ligne.retour?.publieLe != null ? " — corrigé" : ""}
          </p>

          {/* Le nom du fichier et la référence de l'accusé. C'est cette
              référence que l'élève cite quand il affirme avoir rendu : sans
              elle sur cette liste, le professeur n'a rien à recouper. */}
          {ligne.derniere !== null ? (
            <p
              data-testid="suivi-fichier"
              className="m-0 mt-0.5 truncate text-[length:var(--text-aide)] text-[color:var(--color-encre-faible)]"
            >
              <span className="font-mono">{ligne.derniere.reference}</span>
              {ligne.derniere.nomFichier !== null ? ` · ${ligne.derniere.nomFichier}` : ""}
            </p>
          ) : null}
        </div>

        <div className="flex flex-wrap items-center gap-2 print:hidden">
          {ligne.derniere?.fichier != null ? (
            <a
              href={`/documents/${ligne.derniere.fichier}`}
              data-testid="telecharger-copie"
              className="bouton bouton-secondaire bouton-compact"
            >
              Ouvrir la copie
            </a>
          ) : null}

          {ligne.derniere !== null ? (
            <button
              type="button"
              data-testid="ouvrir-correction"
              onClick={() => setOuvert(!ouvert)}
              className="bouton bouton-secondaire bouton-compact"
            >
              {ouvert ? "Fermer" : ligne.retour === null ? "Corriger" : "Modifier la correction"}
            </button>
          ) : null}
        </div>
      </div>

      {papier ? <MarquagePapier devoir={devoir} eleve={ligne.eleve} etat={ligne.etat} /> : null}

      {ouvert && ligne.derniere !== null ? (
        <Correction
          devoir={devoir}
          organisation={organisation}
          version={ligne.derniere.id}
          retour={ligne.retour}
        />
      ) : null}
    </article>
  );
}

/* -------------------------------------------------------------------------- */

function MarquagePapier({
  devoir,
  eleve,
  etat,
}: {
  devoir: string;
  eleve: string;
  etat: string;
}) {
  const [retour, action] = useActionState<EtatDevoirAction, FormData>(
    constaterRemisePapier,
    ETAT_DEVOIR_INITIAL,
  );

  return (
    <form action={action} className="mt-3 flex flex-wrap items-end gap-2 print:hidden">
      <input type="hidden" name="devoir" value={devoir} />
      <input type="hidden" name="eleve" value={eleve} />

      <label className="sr-only" htmlFor={`papier-${eleve}`}>
        État de la remise papier
      </label>
      <select
        id={`papier-${eleve}`}
        data-testid="papier-etat"
        name="etatRemise"
        defaultValue={etat === "brouillon" ? "non_commence" : etat}
        className="champ max-w-[14rem]"
      >
        <option value="non_commence">Non remis</option>
        <option value="remis">Remis</option>
        <option value="remis_en_retard">Remis en retard</option>
      </select>

      <BoutonSimple libelle="Enregistrer" marque="papier-valider" />

      {retour.etat !== "vierge" ? (
        <p
          role="status"
          className="m-0 basis-full text-[length:var(--text-aide)] text-[color:var(--color-encre-faible)]"
        >
          {retour.message}
        </p>
      ) : null}
    </form>
  );
}

/* -------------------------------------------------------------------------- */

function Correction({
  devoir,
  organisation,
  version,
  retour,
}: {
  devoir: string;
  organisation: string;
  version: string;
  retour: LigneEleve["retour"];
}) {
  const [etat, action] = useActionState<EtatDevoirAction, FormData>(
    enregistrerUneCorrection,
    ETAT_DEVOIR_INITIAL,
  );
  const [etatRetrait, retirer] = useActionState<EtatDevoirAction, FormData>(
    retirerUneCorrection,
    ETAT_DEVOIR_INITIAL,
  );

  const base = useId();
  const publiee = retour?.publieLe != null;

  return (
    <div className="mt-4 border-t border-[color:var(--color-bordure)] pt-4 print:hidden">
      <form action={action} encType="multipart/form-data" data-testid="correction-formulaire">
        <input type="hidden" name="devoir" value={devoir} />
        <input type="hidden" name="version" value={version} />
        <input type="hidden" name="organisation" value={organisation} />

        <label className="etiquette" htmlFor={`${base}-commentaire`}>
          Retour à l&apos;élève
        </label>
        <textarea
          id={`${base}-commentaire`}
          data-testid="correction-commentaire-champ"
          name="commentaire"
          rows={3}
          maxLength={5000}
          defaultValue={retour?.commentaire ?? ""}
          className="champ min-h-[5.5rem] py-2.5"
        />

        <div className="mt-3">
          <label className="etiquette" htmlFor={`${base}-fichier`}>
            Copie corrigée (facultatif)
          </label>
          <input
            id={`${base}-fichier`}
            data-testid="correction-fichier"
            name="corrige"
            type="file"
            className="champ h-auto py-2"
            aria-describedby={`${base}-aide`}
          />
          <p id={`${base}-aide`} className="aide-champ">
            Le fichier ne descend chez l&apos;élève qu&apos;une fois la
            correction publiée.
          </p>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-2">
          <button
            type="submit"
            name="publier"
            value="non"
            data-testid="correction-brouillon"
            className="bouton bouton-secondaire"
          >
            Enregistrer en brouillon
          </button>
          <button
            type="submit"
            name="publier"
            value="oui"
            data-testid="correction-publier"
            className="bouton bouton-primaire"
          >
            {publiee ? "Enregistrer et republier" : "Publier à l'élève"}
          </button>
        </div>

        {etat.etat !== "vierge" ? (
          <p
            role={etat.etat === "erreur" ? "alert" : "status"}
            data-testid="correction-retour"
            className={`m-0 mt-3 text-[length:var(--text-tableau)] ${
              etat.etat === "erreur"
                ? "text-[color:var(--color-erreur)]"
                : "text-[color:var(--color-succes)]"
            }`}
          >
            {etat.message}
          </p>
        ) : null}
      </form>

      {publiee && retour !== null ? (
        <form action={retirer} className="mt-3">
          <input type="hidden" name="devoir" value={devoir} />
          <input type="hidden" name="retour" value={retour.id} />
          <BoutonSimple libelle="Retirer la correction" marque="correction-retirer" discret />
          {etatRetrait.etat !== "vierge" ? (
            <p role="status" className="m-0 mt-2 text-[length:var(--text-aide)]">
              {etatRetrait.message}
            </p>
          ) : null}
        </form>
      ) : null}
    </div>
  );
}

function BoutonSimple({
  libelle,
  marque,
  discret = false,
}: {
  libelle: string;
  marque: string;
  discret?: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      data-testid={marque}
      disabled={pending}
      className={`bouton bouton-compact ${discret ? "bouton-discret" : "bouton-secondaire"}`}
    >
      {pending ? "…" : libelle}
    </button>
  );
}
