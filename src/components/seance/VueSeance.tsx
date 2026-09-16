import { tailleLisible } from "@/lib/formats-documents";
import type { Bloc, Seance } from "@/lib/studio";

/**
 * Une séance telle que l'élève la voit — cahier V2, §10.
 *
 * Le même composant sert à l'élève et à la prévisualisation du professeur.
 * C'est la seule façon d'être sûr que « prévisualiser » montre bien ce que
 * verra la classe : s'il y avait deux rendus, ils divergeraient au premier
 * changement.
 *
 * Aucun contrôle d'édition ici, dans aucun des deux cas.
 */
export function VueSeance({
  seance,
  blocs,
  libelleCours,
  chapitre,
}: {
  seance: Seance;
  blocs: Bloc[];
  libelleCours: string;
  chapitre?: string | null;
}) {
  return (
    <article>
      <header className="border-b border-[color:var(--color-bordure)] pb-5">
        <p className="m-0 text-[length:var(--text-tableau)] text-[color:var(--color-encre-faible)]">
          {libelleCours}
          {chapitre ? ` · ${chapitre}` : ""}
        </p>

        <h1 className="mt-2 text-[length:var(--text-h1-app)] leading-[var(--text-h1-app--line-height)]">
          {seance.title}
        </h1>

        {seance.objective ? (
          <p className="m-0 mt-2 max-w-[62ch] text-[color:var(--color-encre-faible)]">
            {seance.objective}
          </p>
        ) : null}

        <p className="m-0 mt-3 text-[length:var(--text-aide)] text-[color:var(--color-encre-tres-faible)]">
          {seance.scheduled_for === null
            ? "Sans date"
            : new Date(seance.scheduled_for).toLocaleDateString("fr-FR", {
                weekday: "long",
                day: "numeric",
                month: "long",
              })}
          {seance.published_at === null
            ? ""
            : ` · mise à jour le ${new Date(seance.updated_at).toLocaleDateString("fr-FR", {
                day: "numeric",
                month: "long",
              })}`}
        </p>
      </header>

      {blocs.length === 0 ? (
        <p className="mt-6 text-[color:var(--color-encre-faible)]">
          Cette séance ne contient encore rien.
        </p>
      ) : (
        <div className="mt-6 space-y-5">
          {blocs.map((bloc) => (
            <BlocLu key={bloc.id} bloc={bloc} />
          ))}
        </div>
      )}
    </article>
  );
}

function BlocLu({ bloc }: { bloc: Bloc }) {
  if (bloc.kind === "texte") {
    return (
      <p className="m-0 max-w-[var(--spacing-lecture)] whitespace-pre-line">
        {String(bloc.contenu.texte ?? "")}
      </p>
    );
  }

  if (bloc.kind === "exercice") {
    return (
      <section className="border-l-2 border-[color:var(--color-rose-decor)] pl-5">
        <h2 className="m-0 text-[length:var(--text-tableau)] font-semibold uppercase tracking-[0.06em] text-[color:var(--color-encre-faible)]">
          Exercice
        </h2>
        <p className="m-0 mt-1.5 max-w-[var(--spacing-lecture)] whitespace-pre-line">
          {String(bloc.contenu.consigne ?? "")}
        </p>
      </section>
    );
  }

  if (bloc.kind === "lien") {
    const url = String(bloc.contenu.url ?? "");
    return (
      <p className="m-0">
        <a
          href={url}
          target="_blank"
          rel="noreferrer noopener"
          className="lien-fleche"
        >
          {String(bloc.contenu.titre ?? url)}
          <span aria-hidden="true" className="fleche">↗</span>
        </a>
      </p>
    );
  }

  if (bloc.kind === "devoir") {
    return (
      <section className="carte p-5">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="m-0 text-[length:var(--text-h2-app)] leading-[var(--text-h2-app--line-height)]">
            {String(bloc.contenu.titre ?? "Devoir")}
          </h2>
          <span className="pastille pastille-publie">Devoir</span>
        </div>
        {bloc.contenu.consigne ? (
          <p className="m-0 mt-2 max-w-[var(--spacing-lecture)] whitespace-pre-line text-[color:var(--color-encre-faible)]">
            {String(bloc.contenu.consigne)}
          </p>
        ) : null}
      </section>
    );
  }

  // Document. Le lien passe par notre route, pas par une URL signée du
  // stockage : l'autorisation est ainsi vérifiée à chaque téléchargement, et
  // non une fois pour toutes au moment où la page a été rendue.
  return (
    <section className="carte p-4">
      {bloc.file_id === null ? (
        <p className="m-0 text-[length:var(--text-tableau)] font-medium">
          {String(bloc.contenu.nom ?? "Document joint")}
        </p>
      ) : (
        <a
          href={`/documents/${bloc.file_id}`}
          className="flex min-h-[var(--spacing-cible)] items-center justify-between gap-3 no-underline"
        >
          <span className="min-w-0">
            <span className="block truncate text-[length:var(--text-tableau)] font-medium text-[color:var(--color-accent)]">
              {String(bloc.contenu.nom ?? "Document joint")}
            </span>
            <span className="mt-0.5 block text-[length:var(--text-aide)] text-[color:var(--color-encre-tres-faible)]">
              {String(bloc.contenu.format ?? "Fichier")}
              {typeof bloc.contenu.taille === "number"
                ? ` · ${tailleLisible(bloc.contenu.taille)}`
                : ""}
            </span>
          </span>
          <span aria-hidden="true" className="text-[color:var(--color-encre-faible)]">
            ↓
          </span>
          <span className="sr-only">Télécharger</span>
        </a>
      )}
    </section>
  );
}
