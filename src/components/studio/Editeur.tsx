"use client";

import { instantLisible, jourLisible } from "@/lib/horodatage";

import Link from "next/link";
import { useActionState, useEffect, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  ajouterBloc,
  deplacerBloc,
  majSeance,
  modifierBloc,
  publierSeance,
  supprimerBloc,
} from "@/app/studio/actions";
import { ETAT_STUDIO_INITIAL, type EtatStudio } from "@/app/studio/etats";
import { ACCEPT_SUPPORTS, FORMATS_ACCEPTES, tailleLisible } from "@/lib/formats-documents";
import type { Bloc, Chapitre, Seance } from "@/lib/studio";

/**
 * Éditeur de séance — cahier V2, §9.4 à §9.7.
 *
 * L'en-tête porte l'identité de la séance et son état ; le corps empile les
 * blocs ; la barre d'ajout propose les cinq types. Chaque geste est un
 * formulaire distinct, donc chaque geste fonctionne sans JavaScript.
 *
 * Le parti pris qui gouverne cet écran : **privilégier la vitesse à l'effet**
 * (§20). Pas d'animation de réordonnancement, pas de glisser-déposer — deux
 * flèches, qui marchent au clavier, sur mobile, et sans surprise.
 */

export function Editeur({
  seance,
  blocs,
  chapitres,
  libelleCours,
}: {
  seance: Seance;
  blocs: Bloc[];
  chapitres: Chapitre[];
  libelleCours: string;
}) {
  const publiee = seance.state === "publiee";

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start">
      <div className="space-y-6">
        <EnteteSeance seance={seance} chapitres={chapitres} libelleCours={libelleCours} />

        <section aria-label="Contenu de la séance">
          {blocs.length === 0 ? (
            <div className="bloc border border-dashed border-[color:var(--color-bordure-forte)] px-6 py-10 text-center">
              <p className="m-0 font-semibold">Cette séance est vide.</p>
              <p className="mx-auto m-0 mt-2 max-w-[48ch] text-[length:var(--text-tableau)] text-[color:var(--color-encre-faible)]">
                Ajoutez le plan du cours, la fiche à distribuer, le devoir à
                rendre. Les blocs s&apos;empilent dans l&apos;ordre où les élèves
                les liront.
              </p>
            </div>
          ) : (
            <ul data-testid="blocs-liste" className="m-0 list-none space-y-3 p-0">
              {blocs.map((bloc, index) => (
                <li key={bloc.id}>
                  <BlocEditable
                    bloc={bloc}
                    seance={seance.id}
                    premier={index === 0}
                    dernier={index === blocs.length - 1}
                  />
                </li>
              ))}
            </ul>
          )}
        </section>

        <AjoutBloc seance={seance.id} />
      </div>

      <aside className="space-y-4 lg:sticky lg:top-24">
        <Publication seance={seance} publiee={publiee} />

        <div className="bloc border border-[color:var(--color-bordure)] p-4">
          <h2 className="m-0 text-[length:var(--text-tableau)] font-semibold uppercase tracking-[0.06em] text-[color:var(--color-encre-faible)]">
            Aperçu
          </h2>
          <p className="m-0 mt-2 text-[length:var(--text-aide)] leading-[var(--text-aide--line-height)] text-[color:var(--color-encre-faible)]">
            Voir la séance exactement comme un élève de la classe la verra,
            avant de la publier.
          </p>
          <Link
            href={`/studio/${seance.id}/apercu`}
            className="bouton bouton-secondaire mt-3 w-full"
          >
            Prévisualiser côté élève
          </Link>
        </div>
      </aside>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function EnteteSeance({
  seance,
  chapitres,
  libelleCours,
}: {
  seance: Seance;
  chapitres: Chapitre[];
  libelleCours: string;
}) {
  const [etat, action] = useActionState<EtatStudio, FormData>(majSeance, ETAT_STUDIO_INITIAL);

  return (
    <form
      action={action}
      data-testid="seance-entete"
      className="bloc border border-[color:var(--color-bordure)] p-5"
    >
      <input type="hidden" name="id" value={seance.id} />

      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="m-0 text-[length:var(--text-tableau)] text-[color:var(--color-encre-faible)]">
          {libelleCours}
        </p>
        <span
          className={`pastille ${seance.state === "publiee" ? "pastille-publie" : "pastille-brouillon"}`}
        >
          {seance.state === "publiee" ? "Publiée" : "Brouillon"}
        </span>
      </div>

      <label className="sr-only" htmlFor="titre-seance">
        Titre de la séance
      </label>
      <input
        id="titre-seance"
        name="titre"
        type="text"
        defaultValue={seance.title}
        maxLength={160}
        required
        className="mt-3 w-full border-0 bg-transparent p-0 text-[length:var(--text-h1-app)] font-bold leading-[var(--text-h1-app--line-height)] tracking-[-0.02em] focus:outline-none focus-visible:outline-2 focus-visible:outline-[color:var(--color-accent)]"
      />

      <div className="mt-4 grid gap-3 sm:grid-cols-2">
        <div>
          <label className="etiquette" htmlFor="chapitre-seance">
            Chapitre
          </label>
          <select
            id="chapitre-seance"
            name="chapitre"
            className="champ"
            defaultValue={seance.chapter_id ?? ""}
          >
            <option value="">Sans chapitre</option>
            {chapitres.map((chapitre) => (
              <option key={chapitre.id} value={chapitre.id}>
                {chapitre.label}
              </option>
            ))}
          </select>
        </div>

        <div>
          <label className="etiquette" htmlFor="date-seance">
            Date
          </label>
          <input
            id="date-seance"
            name="date"
            type="date"
            className="champ"
            defaultValue={seance.scheduled_for?.slice(0, 10) ?? ""}
          />
        </div>
      </div>

      <div className="mt-3">
        <label className="etiquette" htmlFor="objectif-seance">
          Objectif de la séance
        </label>
        <input
          id="objectif-seance"
          name="objectif"
          type="text"
          className="champ"
          maxLength={400}
          defaultValue={seance.objective ?? ""}
          placeholder="Ce que les élèves doivent savoir faire à la fin"
        />
      </div>

      <div className="mt-4 flex flex-wrap items-center gap-3">
        <Bouton libelle="Enregistrer la séance" variante="secondaire" marque="seance-enregistrer" />
        <p className="m-0 text-[length:var(--text-aide)] text-[color:var(--color-encre-tres-faible)]">
          Dernière modification {instantLisible(seance.updated_at)}
        </p>
      </div>

      <Retour etat={etat} />
    </form>
  );
}

function Publication({ seance, publiee }: { seance: Seance; publiee: boolean }) {
  const [etat, action] = useActionState<EtatStudio, FormData>(publierSeance, ETAT_STUDIO_INITIAL);

  return (
    <form
      action={action}
      data-testid="publication"
      data-publiee={publiee ? "oui" : "non"}
      className="bloc border border-[color:var(--color-bordure)] p-4"
    >
      <input type="hidden" name="id" value={seance.id} />
      <input type="hidden" name="publier" value={publiee ? "non" : "oui"} />

      <h2 className="m-0 text-[length:var(--text-tableau)] font-semibold uppercase tracking-[0.06em] text-[color:var(--color-encre-faible)]">
        Publication
      </h2>

      <p className="m-0 mt-2 text-[length:var(--text-aide)] leading-[var(--text-aide--line-height)] text-[color:var(--color-encre-faible)]">
        {publiee ? (
          <>
            Cette séance est visible par la classe depuis le{" "}
            {jourLisible(seance.published_at)}
            . Vous pouvez continuer à la modifier : les élèves voient la date de
            dernière modification.
          </>
        ) : (
          <>
            Tant qu&apos;elle est en brouillon, aucun élève ne la voit. Publier
            la rend visible à cette classe, et à elle seule.
          </>
        )}
      </p>

      <Bouton
        libelle={publiee ? "Dépublier" : "Publier la séance"}
        variante={publiee ? "secondaire" : "rose"}
        pleineLargeur
        marque="publication-basculer"
      />
      <Retour etat={etat} />
    </form>
  );
}

/* -------------------------------------------------------------------------- */

const LIBELLES: Record<string, string> = {
  texte: "Texte",
  document: "Document",
  lien: "Lien",
  exercice: "Exercice",
  devoir: "Devoir",
};

function BlocEditable({
  bloc,
  seance,
  premier,
  dernier,
}: {
  bloc: Bloc;
  seance: string;
  premier: boolean;
  dernier: boolean;
}) {
  const [edition, setEdition] = useState(false);
  const [etatModif, actionModif] = useActionState<EtatStudio, FormData>(
    modifierBloc,
    ETAT_STUDIO_INITIAL,
  );
  const [etatSuppr, actionSuppr] = useActionState<EtatStudio, FormData>(
    supprimerBloc,
    ETAT_STUDIO_INITIAL,
  );
  const [, actionDeplacer] = useActionState<EtatStudio, FormData>(
    deplacerBloc,
    ETAT_STUDIO_INITIAL,
  );

  // Les cinq types se modifient. Auparavant seuls « texte » et « exercice »
  // l'étaient, et corriger une faute dans l'intitulé d'un devoir imposait de le
  // supprimer puis de le recréer — ce qui emportait les remises des élèves.
  const texte = String(bloc.contenu.texte ?? bloc.contenu.consigne ?? "");

  return (
    <article
      data-testid="bloc"
      data-bloc-id={bloc.id}
      data-bloc-type={bloc.kind}
      data-bloc-position={bloc.position}
      className="bloc border border-[color:var(--color-bordure)] p-4"
    >
      <div className="flex flex-wrap items-start justify-between gap-2">
        <span className="text-[0.625rem] font-semibold uppercase tracking-[0.07em] text-[color:var(--color-encre-tres-faible)]">
          {LIBELLES[bloc.kind] ?? bloc.kind}
        </span>

        <div className="flex items-center gap-1">
          {/* Réordonner : deux flèches, utilisables au clavier et au doigt. */}
          <form action={actionDeplacer}>
            <input type="hidden" name="seance" value={seance} />
            <input type="hidden" name="id" value={bloc.id} />
            <input type="hidden" name="sens" value="haut" />
            <button
              type="submit"
              data-testid="bloc-monter"
              disabled={premier}
              aria-label="Déplacer ce bloc vers le haut"
              className="bouton bouton-discret bouton-compact px-2"
            >
              <span aria-hidden="true">↑</span>
            </button>
          </form>

          <form action={actionDeplacer}>
            <input type="hidden" name="seance" value={seance} />
            <input type="hidden" name="id" value={bloc.id} />
            <input type="hidden" name="sens" value="bas" />
            <button
              type="submit"
              data-testid="bloc-descendre"
              disabled={dernier}
              aria-label="Déplacer ce bloc vers le bas"
              className="bouton bouton-discret bouton-compact px-2"
            >
              <span aria-hidden="true">↓</span>
            </button>
          </form>

          <button
            type="button"
            data-testid="bloc-modifier"
            onClick={() => setEdition(!edition)}
            className="bouton bouton-discret bouton-compact"
          >
            {edition ? "Fermer" : "Modifier"}
          </button>
        </div>
      </div>

      <div className="mt-2">
        {edition ? (
          <form action={actionModif} data-testid="bloc-edition">
            <input type="hidden" name="id" value={bloc.id} />
            <input type="hidden" name="seance" value={seance} />
            <ChampsDuType bloc={bloc} texte={texte} />
            <div className="mt-2 flex gap-2">
              <Bouton libelle="Enregistrer ce bloc" variante="secondaire" marque="bloc-enregistrer" />
            </div>
            <Retour etat={etatModif} />
          </form>
        ) : (
          <Apercu bloc={bloc} texte={texte} />
        )}
      </div>

      {/* La suppression est une action séparée, avec confirmation du navigateur.
          Le cahier l'exige pour toute suppression destructive (§9.2). */}
      <form
        action={actionSuppr}
        className="mt-3 border-t border-[color:var(--color-bordure)] pt-3"
      >
        <input type="hidden" name="id" value={bloc.id} />
        <input type="hidden" name="seance" value={seance} />
        <BoutonSuppression estDevoir={bloc.kind === "devoir"} />
        <Retour etat={etatSuppr} />
      </form>
    </article>
  );
}

/**
 * Les champs modifiables d'un bloc, selon son type.
 *
 * Chaque type n'envoie que **ses** champs. Un formulaire unique qui posterait
 * tous les noms écraserait avec du vide ce qu'il n'affiche pas — l'URL d'un
 * lien disparaîtrait en corrigeant son intitulé.
 *
 * Le fichier d'un bloc « document » ne se remplace pas ici : seul son nom
 * affiché se corrige. Remplacer le fichier, c'est déposer un autre document,
 * et le cahier veut que cela se voie.
 */
function ChampsDuType({ bloc, texte }: { bloc: Bloc; texte: string }) {
  if (bloc.kind === "lien") {
    return (
      <div className="space-y-3">
        <div>
          <label className="etiquette" htmlFor={`url-${bloc.id}`}>
            Adresse
          </label>
          <input
            id={`url-${bloc.id}`}
            data-testid="bloc-url"
            name="url"
            type="url"
            required
            defaultValue={String(bloc.contenu.url ?? "")}
            className="champ"
          />
        </div>
        <div>
          <label className="etiquette" htmlFor={`titre-${bloc.id}`}>
            Intitulé
          </label>
          <input
            id={`titre-${bloc.id}`}
            data-testid="bloc-titre"
            name="titre"
            type="text"
            maxLength={160}
            defaultValue={String(bloc.contenu.titre ?? "")}
            className="champ"
          />
        </div>
      </div>
    );
  }

  if (bloc.kind === "devoir") {
    return (
      <div className="space-y-3">
        <div className="grid gap-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
          <div>
            <label className="etiquette" htmlFor={`titre-${bloc.id}`}>
              Titre du devoir
            </label>
            <input
              id={`titre-${bloc.id}`}
              data-testid="bloc-titre"
              name="titre"
              type="text"
              required
              maxLength={160}
              defaultValue={String(bloc.contenu.titre ?? "")}
              className="champ"
            />
          </div>
          <div>
            <label className="etiquette" htmlFor={`echeance-${bloc.id}`}>
              À rendre le
            </label>
            <input
              id={`echeance-${bloc.id}`}
              data-testid="bloc-echeance"
              name="echeance"
              type="date"
              defaultValue={String(bloc.contenu.echeance ?? "")}
              className="champ"
            />
          </div>
        </div>
        <div>
          <label className="etiquette" htmlFor={`consigne-${bloc.id}`}>
            Consigne
          </label>
          <textarea
            id={`consigne-${bloc.id}`}
            data-testid="bloc-consigne"
            name="consigne"
            rows={3}
            maxLength={5000}
            defaultValue={String(bloc.contenu.consigne ?? "")}
            className="champ min-h-[5.5rem] py-2.5"
          />
        </div>
      </div>
    );
  }

  if (bloc.kind === "document") {
    return (
      <div>
        <label className="etiquette" htmlFor={`nom-${bloc.id}`}>
          Nom affiché
        </label>
        <input
          id={`nom-${bloc.id}`}
          data-testid="bloc-nom"
          name="nom"
          type="text"
          required
          maxLength={200}
          defaultValue={String(bloc.contenu.nom ?? "")}
          className="champ"
        />
        <p className="aide-champ">
          Le fichier lui-même ne change pas. Pour en mettre un autre, ajoutez un
          nouveau bloc « Document » et retirez celui-ci.
        </p>
      </div>
    );
  }

  return (
    <>
      <label className="sr-only" htmlFor={`texte-${bloc.id}`}>
        Contenu du bloc
      </label>
      <textarea
        id={`texte-${bloc.id}`}
        data-testid="bloc-texte"
        name="texte"
        rows={4}
        defaultValue={texte}
        maxLength={5000}
        className="champ min-h-[7rem] py-2.5"
      />
    </>
  );
}

function Apercu({ bloc, texte }: { bloc: Bloc; texte: string }) {
  if (bloc.kind === "lien") {
    const url = String(bloc.contenu.url ?? "");
    return (
      <p className="m-0">
        <a
          href={url}
          target="_blank"
          rel="noreferrer noopener"
          className="text-[color:var(--color-accent)]"
        >
          {String(bloc.contenu.titre ?? url)}
        </a>
      </p>
    );
  }

  if (bloc.kind === "devoir") {
    return (
      <>
        <p className="m-0 font-medium">{String(bloc.contenu.titre ?? "Devoir")}</p>
        {bloc.contenu.consigne ? (
          <p className="m-0 mt-1 whitespace-pre-line text-[length:var(--text-tableau)] text-[color:var(--color-encre-faible)]">
            {String(bloc.contenu.consigne)}
          </p>
        ) : null}
      </>
    );
  }

  if (bloc.kind === "document") {
    return (
      <p className="m-0 text-[length:var(--text-tableau)]">
        {bloc.file_id === null ? (
          String(bloc.contenu.nom ?? "Document joint")
        ) : (
          <a href={`/documents/${bloc.file_id}`} className="text-[color:var(--color-accent)]">
            {String(bloc.contenu.nom ?? "Document joint")}
          </a>
        )}
        {typeof bloc.contenu.taille === "number" ? (
          <span className="ml-2 text-[color:var(--color-encre-tres-faible)]">
            {tailleLisible(bloc.contenu.taille)}
          </span>
        ) : null}
      </p>
    );
  }

  return <p className="m-0 whitespace-pre-line">{texte}</p>;
}

/* -------------------------------------------------------------------------- */

const TYPES = [
  { cle: "texte", libelle: "Texte", aide: "Le plan du cours, une explication, une consigne générale." },
  { cle: "exercice", libelle: "Exercice", aide: "Une consigne d'exercice, à faire en classe ou à la maison." },
  { cle: "lien", libelle: "Lien", aide: "Une page, une vidéo, une ressource en ligne." },
  { cle: "devoir", libelle: "Devoir", aide: "Un travail à rendre, avec une échéance. Il apparaît dans « À faire » chez l'élève." },
  { cle: "document", libelle: "Document", aide: `Un fichier joint à la séance : ${FORMATS_ACCEPTES}. 20 Mo au maximum.` },
] as const;

function AjoutBloc({ seance }: { seance: string }) {
  const [type, setType] = useState<string | null>(null);
  const [etat, action] = useActionState<EtatStudio, FormData>(ajouterBloc, ETAT_STUDIO_INITIAL);

  // Le bloc ajouté, le formulaire se referme et rend la main à la barre de
  // choix. Sans cela il restait ouvert sur le type précédent, avec ses champs
  // vidés : pour ajouter un second bloc d'un autre type, il fallait deviner
  // qu'il faut d'abord annuler. On revient à l'état d'où l'on était parti.
  useEffect(() => {
    if (etat.etat === "ok") setType(null);
  }, [etat]);

  if (type === null) {
    return (
      <div className="bloc border border-[color:var(--color-bordure)] p-4">
        <h2 className="m-0 text-[length:var(--text-tableau)] font-semibold uppercase tracking-[0.06em] text-[color:var(--color-encre-faible)]">
          Ajouter au cours
        </h2>
        <div className="mt-3 flex flex-wrap gap-2">
          {TYPES.map((entree) => (
            <button
              key={entree.cle}
              type="button"
              data-testid={`ajouter-${entree.cle}`}
              onClick={() => setType(entree.cle)}
              className="bouton bouton-secondaire bouton-compact"
            >
              + {entree.libelle}
            </button>
          ))}
        </div>
      </div>
    );
  }

  const choisi = TYPES.find((entree) => entree.cle === type)!;

  return (
    <form
      action={action}
      encType="multipart/form-data"
      data-testid="bloc-nouveau"
      data-type-en-cours={type}
      className="bloc border border-[color:var(--color-accent)] p-4"
    >
      <input type="hidden" name="seance" value={seance} />
      <input type="hidden" name="type" value={type} />

      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="m-0 text-[length:var(--text-h2-app)] leading-[var(--text-h2-app--line-height)]">
          Nouveau bloc — {choisi.libelle}
        </h2>
        <button
          type="button"
          data-testid="bloc-annuler"
          onClick={() => setType(null)}
          className="bouton bouton-discret bouton-compact"
        >
          Annuler
        </button>
      </div>

      <p className="m-0 mt-1 text-[length:var(--text-aide)] text-[color:var(--color-encre-faible)]">
        {choisi.aide}
      </p>

      <div className="mt-4 space-y-3">
        {(type === "texte" || type === "exercice") && (
          <div>
            <label className="etiquette" htmlFor="contenu-bloc">
              {type === "texte" ? "Texte" : "Consigne"}
            </label>
            <textarea
              id="contenu-bloc"
              data-testid="champ-texte"
              name="texte"
              rows={4}
              maxLength={5000}
              required
              autoFocus
              className="champ min-h-[7rem] py-2.5"
            />
          </div>
        )}

        {type === "document" && (
          <div>
            <label className="etiquette" htmlFor="fichier-bloc">
              Fichier
            </label>
            <input
              id="fichier-bloc"
              data-testid="champ-fichier"
              name="fichier"
              type="file"
              required
              accept={ACCEPT_SUPPORTS}
              className="champ h-auto py-2"
            />
            <p className="aide-champ">
              Le fichier est vérifié sur son contenu, pas sur son nom, et n&apos;est
              accessible qu&apos;aux élèves de ce cours — et seulement une fois la
              séance publiée.
            </p>
          </div>
        )}

        {type === "lien" && (
          <>
            <div>
              <label className="etiquette" htmlFor="url-bloc">
                Adresse
              </label>
              <input
                id="url-bloc"
                data-testid="champ-url"
                name="url"
                type="url"
                required
                autoFocus
                placeholder="https://"
                className="champ"
              />
            </div>
            <div>
              <label className="etiquette" htmlFor="titre-lien">
                Intitulé
              </label>
              <input
                id="titre-lien"
                data-testid="champ-titre-lien"
                name="titre"
                type="text"
                maxLength={160}
                className="champ"
              />
            </div>
          </>
        )}

        {type === "devoir" && (
          <>
            <div className="grid gap-3 sm:grid-cols-[minmax(0,2fr)_minmax(0,1fr)]">
              <div>
                <label className="etiquette" htmlFor="titre-devoir">
                  Titre du devoir
                </label>
                <input
                  id="titre-devoir"
                  data-testid="champ-titre-devoir"
                  name="titre"
                  type="text"
                  required
                  autoFocus
                  maxLength={160}
                  placeholder="Devoir maison n° 2"
                  className="champ"
                />
              </div>
              <div>
                <label className="etiquette" htmlFor="echeance-devoir">
                  À rendre le
                </label>
                <input
                  id="echeance-devoir"
                  data-testid="champ-echeance"
                  name="echeance"
                  type="date"
                  className="champ"
                />
              </div>
            </div>
            <div>
              <label className="etiquette" htmlFor="consigne-devoir">
                Consigne
              </label>
              <textarea
                id="consigne-devoir"
                data-testid="champ-consigne"
                name="consigne"
                rows={3}
                maxLength={5000}
                className="champ min-h-[5.5rem] py-2.5"
              />
            </div>
          </>
        )}
      </div>

      <div className="mt-4">
        <Bouton libelle="Ajouter le bloc" variante="rose" marque="bloc-ajouter" />
      </div>
      <Retour etat={etat} />
    </form>
  );
}

/* -------------------------------------------------------------------------- */

function Bouton({
  libelle,
  variante = "rose",
  pleineLargeur = false,
  marque,
}: {
  libelle: string;
  variante?: "rose" | "secondaire";
  pleineLargeur?: boolean;
  /** Identifiant stable pour la recette : deux boutons « Enregistrer » ne se
      distinguent pas par leur texte, et un script qui prend « le premier »
      teste ce qu il trouve, pas ce qu il vise. */
  marque?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      data-testid={marque}
      disabled={pending}
      className={`bouton bouton-${variante} ${pleineLargeur ? "mt-3 w-full" : ""}`}
    >
      {pending ? "…" : libelle}
    </button>
  );
}

function BoutonSuppression({ estDevoir }: { estDevoir: boolean }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      data-testid="bloc-supprimer"
      disabled={pending}
      onClick={(evenement) => {
        const message = estDevoir
          ? "Supprimer ce bloc supprimera aussi le devoir, y compris chez les élèves. Continuer ?"
          : "Supprimer ce bloc ?";
        if (!window.confirm(message)) evenement.preventDefault();
      }}
      className="bouton bouton-discret bouton-compact text-[color:var(--color-erreur)]"
    >
      {pending ? "…" : "Supprimer ce bloc"}
    </button>
  );
}

function Retour({ etat }: { etat: EtatStudio }) {
  if (etat.etat === "vierge" || !etat.message) return null;
  return (
    <p
      role="status"
      data-testid="retour"
      data-etat={etat.etat}
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
