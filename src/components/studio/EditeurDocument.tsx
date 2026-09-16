"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { enregistrerRevision } from "@/app/professeur/studio/actions";
import {
  deplacerBloc,
  relireReglages,
  remplacerBloc,
  supprimerBloc,
  texteDuBloc,
  type BlocCours,
  type DocumentCours,
  type Modele,
  type ReglagesPresentation,
} from "@/lib/document-cours";
import { RenduDocument } from "./RenduDocument";

/**
 * Éditeur du Studio — S07 à S12.
 *
 * Trois colonnes sur grand écran : l'original à gauche, le document mis en page
 * au centre, les réglages à droite. En dessous de 1 024 px, l'original et les
 * réglages passent en panneaux repliables, et le document garde toute la
 * largeur — réduire trois colonnes jusqu'à 300 px rendrait le texte illisible,
 * ce que le cahier interdit explicitement.
 *
 * Deux principes gouvernent tout le reste :
 *
 *  1. **Changer de présentation ne touche pas au texte.** Les réglages
 *     modifient `reglages`, jamais `document.blocs`. C'est structurel, pas une
 *     précaution : il n'existe aucun chemin par lequel un choix de modèle
 *     pourrait réécrire une formule.
 *  2. **Un changement de style ne coûte rien.** L'aperçu se recalcule dans le
 *     navigateur, sans requête et sans appel de modèle (O01, P03).
 */

export interface DocumentInitial {
  readonly id: string;
  readonly etat: string;
  readonly revision: number;
  readonly document: DocumentCours;
  readonly reglages: ReglagesPresentation;
  readonly fichierSource: string | null;
}

type EtatSauvegarde = "repos" | "enregistrement" | "enregistre" | "conflit" | "echec";

const MODELES: readonly { cle: Modele; libelle: string; aide: string }[] = [
  { cle: "classique", libelle: "Classique", aide: "Titres en serif, encadrés roses, marges larges." },
  { cle: "fiche", libelle: "Fiche", aide: "Plus compact, pour réviser. Rien n'est retiré." },
  { cle: "aere", libelle: "Aéré", aide: "Texte plus grand et plus espacé." },
];

export function EditeurDocument({ initial }: { initial: DocumentInitial }) {
  const [document, setDocument] = useState(initial.document);
  const [reglages, setReglages] = useState(initial.reglages);
  const [revision, setRevision] = useState(initial.revision);
  const [sauvegarde, setSauvegarde] = useState<EtatSauvegarde>("repos");
  const [message, setMessage] = useState<string | null>(null);
  const [panneau, setPanneau] = useState<"resultat" | "original" | "reglages">("resultat");

  // `modifie` distingue « rien n'a bougé » de « tout est enregistré » : sans
  // cela, l'alerte de sortie se déclencherait sur une page seulement consultée.
  const modifie = useRef(false);
  const minuteur = useRef<number | null>(null);

  const enregistrer = useCallback(async () => {
    setSauvegarde("enregistrement");

    const donnees = new FormData();
    donnees.set("document", initial.id);
    donnees.set("attendue", String(revision));
    donnees.set("brouillon", JSON.stringify({ document, reglages }));

    const retour = await enregistrerRevision({ etat: "vierge" }, donnees);

    if (retour.etat === "enregistre") {
      setRevision(retour.revision ?? revision);
      setSauvegarde("enregistre");
      setMessage(null);
      modifie.current = false;
      return;
    }

    setSauvegarde(retour.etat === "conflit" ? "conflit" : "echec");
    setMessage(retour.message ?? "L'enregistrement a échoué.");
  }, [document, reglages, revision, initial.id]);

  /**
   * Sauvegarde 800 ms après la dernière frappe, et groupée : une phrase tapée
   * au clavier produit une révision, pas quarante.
   */
  useEffect(() => {
    if (!modifie.current) return;
    if (minuteur.current !== null) window.clearTimeout(minuteur.current);
    minuteur.current = window.setTimeout(() => void enregistrer(), 800);
    return () => {
      if (minuteur.current !== null) window.clearTimeout(minuteur.current);
    };
  }, [document, reglages, enregistrer]);

  // Rien ne se perd en fermant l'onglet sans s'en rendre compte.
  useEffect(() => {
    const avertir = (evenement: BeforeUnloadEvent) => {
      if (modifie.current) evenement.preventDefault();
    };
    window.addEventListener("beforeunload", avertir);
    return () => window.removeEventListener("beforeunload", avertir);
  }, []);

  const changerDocument = (suivant: DocumentCours) => {
    modifie.current = true;
    setDocument(suivant);
  };

  const changerReglages = (partiel: Partial<ReglagesPresentation>) => {
    modifie.current = true;
    setReglages((precedent) => relireReglages({ ...precedent, ...partiel }));
  };

  const original = useMemo(
    () => initial.document.blocs.map(texteDuBloc).join("\n\n"),
    [initial.document],
  );

  return (
    <div className="flex min-h-[calc(100dvh-108px)] flex-col">
      {/* ---- Barre de titre ------------------------------------------- */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[color:var(--color-bordure)] pb-4">
        <div className="min-w-0">
          <label className="sr-only" htmlFor="titre-document">
            Titre du cours
          </label>
          <input
            id="titre-document"
            value={document.titre}
            onChange={(evenement) =>
              changerDocument({ ...document, titre: evenement.target.value.slice(0, 120) })
            }
            className="w-full max-w-[34rem] border-0 bg-transparent p-0 text-[length:var(--text-h1-app)] font-bold leading-[var(--text-h1-app--line-height)] tracking-[-0.02em] outline-none focus-visible:underline"
          />
          <p className="m-0 mt-1 text-[length:var(--text-aide)] text-[color:var(--color-encre-tres-faible)]">
            <Indicateur etat={sauvegarde} />
          </p>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Link
            href={`/professeur/studio/${initial.id}/apercu`}
            className="bouton bouton-secondaire bouton-compact"
          >
            Aperçu
          </Link>
          <Link
            href={`/professeur/studio/${initial.id}/publication`}
            className="bouton bouton-primaire bouton-compact"
          >
            Continuer
            <span aria-hidden="true" className="fleche">→</span>
          </Link>
        </div>
      </div>

      {message !== null ? (
        <p
          role="alert"
          className="m-0 mt-4 rounded-[var(--radius-champ)] border border-[color:var(--color-erreur)] bg-[color:var(--color-erreur-fond)] p-3 text-[length:var(--text-tableau)] text-[color:var(--color-erreur)]"
        >
          {message}{" "}
          {sauvegarde === "conflit" ? null : (
            <button type="button" onClick={() => void enregistrer()} className="underline">
              Réessayer
            </button>
          )}
        </p>
      ) : null}

      {/* ---- Onglets de repli, sous 1024 px ---------------------------- */}
      <div role="tablist" aria-label="Panneaux" className="mt-4 flex gap-1 lg:hidden">
        {(
          [
            ["resultat", "Résultat"],
            ["original", "Original"],
            ["reglages", "Réglages"],
          ] as const
        ).map(([cle, libelle]) => (
          <button
            key={cle}
            type="button"
            role="tab"
            aria-selected={panneau === cle}
            onClick={() => setPanneau(cle)}
            className={`min-h-9 rounded-[var(--radius-champ)] px-3.5 text-[length:var(--text-tableau)] ${
              panneau === cle
                ? "bg-[color:var(--color-rose-clair)] font-semibold text-[color:var(--color-accent)]"
                : "text-[color:var(--color-encre-faible)]"
            }`}
          >
            {libelle}
          </button>
        ))}
      </div>

      {/* ---- Trois colonnes -------------------------------------------- */}
      <div className="mt-5 grid flex-1 gap-6 lg:grid-cols-[220px_minmax(0,1fr)_240px] lg:items-start">
        {/* Original */}
        <aside
          hidden={panneau !== "original"}
          className="lg:!block lg:sticky lg:top-24 lg:max-h-[calc(100dvh-160px)] lg:overflow-y-auto"
        >
          <h2 className="m-0 text-[length:var(--text-aide)] font-semibold uppercase tracking-[0.08em] text-[color:var(--color-encre-faible)]">
            Original
          </h2>
          {initial.fichierSource !== null ? (
            <p className="m-0 mt-2">
              <a
                href={`/documents/${initial.fichierSource}`}
                className="text-[length:var(--text-aide)] text-[color:var(--color-accent)]"
              >
                Ouvrir le fichier d&apos;origine
              </a>
            </p>
          ) : null}
          <pre className="mt-3 whitespace-pre-wrap rounded-[var(--radius-champ)] border border-[color:var(--color-bordure)] bg-[color:var(--color-surface-douce)] p-3 font-mono text-[0.6875rem] leading-relaxed text-[color:var(--color-encre-faible)]">
            {original}
          </pre>
        </aside>

        {/* Document mis en page */}
        <div hidden={panneau !== "resultat"} className="lg:!block">
          <div className="rounded-[var(--radius-carte)] border border-[color:var(--color-bordure)] bg-[color:var(--color-surface)] p-6 shadow-[var(--shadow-flottant)] sm:p-10">
            <RenduDocument document={document} reglages={reglages} />
          </div>

          <Blocs document={document} surChangement={changerDocument} />
        </div>

        {/* Présentation */}
        <aside
          hidden={panneau !== "reglages"}
          className="lg:!block lg:sticky lg:top-24"
        >
          <h2 className="m-0 text-[length:var(--text-aide)] font-semibold uppercase tracking-[0.08em] text-[color:var(--color-encre-faible)]">
            Présentation
          </h2>

          <div role="radiogroup" aria-label="Modèle" className="mt-3 grid grid-cols-3 gap-2">
            {MODELES.map((modele) => (
              <button
                key={modele.cle}
                type="button"
                role="radio"
                aria-checked={reglages.modele === modele.cle}
                title={modele.aide}
                onClick={() => changerReglages({ modele: modele.cle })}
                className={`rounded-[var(--radius-champ)] border px-2 py-3 text-[0.6875rem] ${
                  reglages.modele === modele.cle
                    ? "border-[color:var(--color-accent)] bg-[color:var(--color-rose-clair)] font-semibold text-[color:var(--color-accent)]"
                    : "border-[color:var(--color-bordure)]"
                }`}
              >
                {modele.libelle}
              </button>
            ))}
          </div>
          <p className="m-0 mt-2 text-[length:var(--text-aide)] leading-[var(--text-aide--line-height)] text-[color:var(--color-encre-tres-faible)]">
            {MODELES.find((modele) => modele.cle === reglages.modele)?.aide}
          </p>

          <Curseur
            libelle="Taille de lecture"
            valeur={reglages.taille}
            min={0.9}
            max={1.4}
            pas={0.05}
            surChangement={(taille) => changerReglages({ taille })}
          />
          <Curseur
            libelle="Interligne"
            valeur={reglages.interligne}
            min={1.4}
            max={2}
            pas={0.1}
            surChangement={(interligne) => changerReglages({ interligne })}
          />

          <Bascule
            libelle="Numéros de page"
            actif={reglages.numerosDePage}
            surChangement={(numerosDePage) => changerReglages({ numerosDePage })}
          />
          <Bascule
            libelle="Sommaire"
            actif={reglages.sommaire}
            surChangement={(valeur) => changerReglages({ sommaire: valeur })}
          />

          <RapportConversion document={initial.document} etat={initial.etat} id={initial.id} />
        </aside>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function Indicateur({ etat }: { etat: EtatSauvegarde }) {
  const mots: Record<EtatSauvegarde, string> = {
    repos: "Brouillon",
    enregistrement: "Enregistrement…",
    enregistre: "Brouillon enregistré",
    conflit: "Non enregistré",
    echec: "Échec — réessayer",
  };
  return <span role="status">{mots[etat]}</span>;
}

function Curseur({
  libelle,
  valeur,
  min,
  max,
  pas,
  surChangement,
}: {
  libelle: string;
  valeur: number;
  min: number;
  max: number;
  pas: number;
  surChangement: (valeur: number) => void;
}) {
  return (
    <div className="mt-5">
      <label className="etiquette">
        {libelle}
        <input
          type="range"
          min={min}
          max={max}
          step={pas}
          value={valeur}
          onChange={(evenement) => surChangement(Number(evenement.target.value))}
          className="mt-1.5 w-full accent-[color:var(--color-accent)]"
        />
      </label>
    </div>
  );
}

function Bascule({
  libelle,
  actif,
  surChangement,
}: {
  libelle: string;
  actif: boolean;
  surChangement: (valeur: boolean) => void;
}) {
  return (
    <label className="mt-4 flex min-h-[var(--spacing-cible)] items-center justify-between gap-3 text-[length:var(--text-tableau)]">
      {libelle}
      <input
        type="checkbox"
        checked={actif}
        onChange={(evenement) => surChangement(evenement.target.checked)}
        className="size-4 accent-[color:var(--color-accent)]"
      />
    </label>
  );
}

/**
 * Rapport de conversion — S11.
 *
 * « Contenu à vérifier » tant que le professeur n'a pas confirmé, et
 * « Vérifié par vos soins » après. La nuance n'est pas cosmétique : rien dans
 * un traitement réussi ne prouve qu'aucun contenu n'a été perdu, et seul un
 * humain peut le dire.
 */
function RapportConversion({
  document,
  etat,
  id,
}: {
  document: DocumentCours;
  etat: string;
  id: string;
}) {
  const alertes = document.rapport.alertes;
  const verifie = etat === "pret";

  return (
    <section className="mt-8 rounded-[var(--radius-champ)] border border-[color:var(--color-bordure)] p-3.5">
      <p
        className={`m-0 text-[length:var(--text-tableau)] font-semibold ${
          verifie ? "text-[color:var(--color-succes)]" : "text-[color:var(--color-attention)]"
        }`}
      >
        {verifie ? "Vérifié par vos soins" : "Contenu à vérifier"}
      </p>

      <dl className="m-0 mt-2 space-y-0.5 text-[length:var(--text-aide)] text-[color:var(--color-encre-faible)]">
        {document.rapport.pagesLues > 0 ? (
          <div className="flex justify-between gap-2">
            <dt>Pages lues</dt>
            <dd className="m-0">{document.rapport.pagesLues}</dd>
          </div>
        ) : null}
        <div className="flex justify-between gap-2">
          <dt>Blocs extraits</dt>
          <dd className="m-0">{document.rapport.blocsExtraits}</dd>
        </div>
      </dl>

      {alertes.length > 0 ? (
        <ul className="m-0 mt-3 list-none space-y-2 p-0">
          {alertes.map((alerte, index) => (
            <li
              key={index}
              className="text-[length:var(--text-aide)] leading-[var(--text-aide--line-height)] text-[color:var(--color-attention)]"
            >
              {alerte.message}
              {alerte.page !== undefined ? ` (page ${alerte.page})` : ""}
            </li>
          ))}
        </ul>
      ) : (
        <p className="m-0 mt-2 text-[length:var(--text-aide)] leading-[var(--text-aide--line-height)] text-[color:var(--color-encre-tres-faible)]">
          Aucune zone incertaine signalée. Relisez tout de même : ce contrôle
          porte sur la lecture du fichier, pas sur le sens du cours.
        </p>
      )}

      {verifie ? null : (
        <form action={`/professeur/studio/${id}/revue`} method="get" className="mt-3">
          <Link href={`/professeur/studio/${id}/publication`} className="lien-fleche text-[length:var(--text-aide)]">
            Vérifier puis publier
            <span aria-hidden="true" className="fleche">→</span>
          </Link>
        </form>
      )}
    </section>
  );
}

/**
 * Liste d'édition des blocs — S09.
 *
 * Sous le document, pas par-dessus : on lit le résultat, puis on corrige. Le
 * réordonnancement se fait par boutons, jamais uniquement par glisser-déposer
 * (P07).
 */
function Blocs({
  document,
  surChangement,
}: {
  document: DocumentCours;
  surChangement: (suivant: DocumentCours) => void;
}) {
  const [ouvert, setOuvert] = useState(false);

  return (
    <section className="mt-6">
      <button
        type="button"
        onClick={() => setOuvert((valeur) => !valeur)}
        aria-expanded={ouvert}
        className="bouton bouton-secondaire bouton-compact"
      >
        {ouvert ? "Masquer" : "Corriger le contenu"}
      </button>

      <ul hidden={!ouvert} className="m-0 mt-4 list-none space-y-2 p-0">
        {document.blocs.map((bloc, index) => (
          <li
            key={index}
            className="rounded-[var(--radius-champ)] border border-[color:var(--color-bordure)] p-3"
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[length:var(--text-aide)] uppercase tracking-[0.06em] text-[color:var(--color-encre-tres-faible)]">
                {bloc.type}
                {bloc.origine ? ` · page ${bloc.origine.page}` : ""}
              </span>
              <span className="flex gap-1">
                <BoutonBloc
                  libelle="Monter"
                  desactive={index === 0}
                  onClick={() => surChangement(deplacerBloc(document, index, "haut"))}
                />
                <BoutonBloc
                  libelle="Descendre"
                  desactive={index === document.blocs.length - 1}
                  onClick={() => surChangement(deplacerBloc(document, index, "bas"))}
                />
                <BoutonBloc
                  libelle="Supprimer"
                  onClick={() => surChangement(supprimerBloc(document, index))}
                />
              </span>
            </div>

            <ChampBloc
              bloc={bloc}
              surChangement={(suivant) => surChangement(remplacerBloc(document, index, suivant))}
            />
          </li>
        ))}
      </ul>
    </section>
  );
}

function BoutonBloc({
  libelle,
  onClick,
  desactive = false,
}: {
  libelle: string;
  onClick: () => void;
  desactive?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={desactive}
      className="min-h-8 rounded-[6px] border border-[color:var(--color-bordure)] px-2 text-[length:var(--text-aide)] disabled:opacity-40"
    >
      {libelle}
    </button>
  );
}

function ChampBloc({
  bloc,
  surChangement,
}: {
  bloc: BlocCours;
  surChangement: (suivant: BlocCours) => void;
}) {
  if (bloc.type === "titre" || bloc.type === "paragraphe" || bloc.type === "brut") {
    return (
      <textarea
        value={bloc.texte}
        onChange={(evenement) => surChangement({ ...bloc, texte: evenement.target.value })}
        rows={bloc.type === "titre" ? 1 : 3}
        className="champ mt-2 min-h-0 py-2 font-mono text-[0.8125rem]"
      />
    );
  }

  if (bloc.type === "encadre") {
    return (
      <textarea
        value={bloc.texte}
        onChange={(evenement) => surChangement({ ...bloc, texte: evenement.target.value })}
        rows={2}
        className="champ mt-2 min-h-0 py-2 font-mono text-[0.8125rem]"
      />
    );
  }

  if (bloc.type === "liste") {
    return (
      <textarea
        value={bloc.elements.join("\n")}
        onChange={(evenement) =>
          surChangement({
            ...bloc,
            elements: evenement.target.value.split("\n").filter((ligne) => ligne.trim() !== ""),
          })
        }
        rows={Math.min(8, bloc.elements.length + 1)}
        className="champ mt-2 min-h-0 py-2 font-mono text-[0.8125rem]"
      />
    );
  }

  if (bloc.type === "image") {
    return (
      <input
        value={bloc.legende ?? ""}
        placeholder="Légende de l'image"
        onChange={(evenement) => surChangement({ ...bloc, legende: evenement.target.value })}
        className="champ mt-2"
      />
    );
  }

  return (
    <p className="m-0 mt-2 text-[length:var(--text-aide)] text-[color:var(--color-encre-tres-faible)]">
      Ce tableau se corrige à la main dans le document d&apos;origine, puis se
      réimporte.
    </p>
  );
}
