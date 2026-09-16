import type {
  BlocCours,
  DocumentCours,
  ReglagesPresentation,
} from "@/lib/document-cours";
import { sommaire } from "@/lib/document-cours";

/**
 * Rendu d'un document de cours — cahier « Refonte fidèle », S08 et S16.
 *
 * **Un seul rendu pour tout le monde** : l'aperçu du professeur, la vue de
 * l'élève, la projection et la page A4 passent tous par ce composant. C'est ce
 * qui garantit que « prévisualiser » dise la vérité — s'il y avait deux
 * implémentations, elles divergeraient au premier changement.
 *
 * Les trois modèles changent la **présentation**, jamais le contenu : mêmes
 * blocs, même ordre, mêmes chaînes de caractères. Le modèle « Fiche » resserre
 * la hiérarchie ; il ne résume rien. Un test compare le texte intégral d'un
 * modèle à l'autre et échoue si un seul caractère bouge (S10).
 *
 * Aucun état, aucun effet : ce composant est rendu côté serveur, y compris
 * pour l'élève. Le lecteur de PDF et l'éditeur, eux, ne le sont pas et ne
 * partent que sur les routes qui en ont besoin (P03).
 */

export type ModeRendu = "ecran" | "projection" | "a4";

const MODELES = {
  classique: {
    // Georgia pour le corps : c'est le modèle « document », celui qui ressemble
    // à un polycopié. La référence l'emploie.
    police: "var(--font-marque)",
    titre: "text-[1.75rem] sm:text-[2rem]",
    sousTitre: "text-[1.25rem]",
    espace: "space-y-5",
    encadre: "bg-[color:var(--color-rose-clair)] rounded-[var(--radius-champ)] p-5",
  },
  fiche: {
    // Sans empattement et resserré : une fiche se parcourt, elle ne se lit pas
    // d'un bout à l'autre. Rien n'est retiré pour autant.
    police: "var(--font-texte)",
    titre: "text-[1.5rem] sm:text-[1.75rem]",
    sousTitre: "text-[1.0625rem]",
    espace: "space-y-3.5",
    encadre:
      "border-l-[3px] border-[color:var(--color-accent)] bg-[color:var(--color-surface-douce)] rounded-r-[var(--radius-champ)] py-3 pl-4 pr-4",
  },
  aere: {
    police: "var(--font-texte)",
    titre: "text-[2rem] sm:text-[2.25rem]",
    sousTitre: "text-[1.375rem]",
    espace: "space-y-8",
    encadre: "bg-[color:var(--color-rose-clair)] rounded-[var(--radius-carte)] p-6",
  },
} as const;

export function RenduDocument({
  document,
  reglages,
  mode = "ecran",
}: {
  document: DocumentCours;
  reglages: ReglagesPresentation;
  mode?: ModeRendu;
}) {
  const style = MODELES[reglages.modele];
  const entrees = reglages.sommaire ? sommaire(document) : [];

  // La projection force une taille bien plus grande : ce qui compte au fond de
  // la salle, c'est la hauteur des lettres, pas le réglage de confort du
  // professeur.
  const facteur = mode === "projection" ? Math.max(reglages.taille, 1.5) : reglages.taille;

  return (
    <article
      data-modele={reglages.modele}
      data-mode={mode}
      style={{
        fontFamily: style.police,
        fontSize: `${facteur}rem`,
        lineHeight: reglages.interligne,
      }}
      className={
        mode === "a4"
          ? "mx-auto w-full max-w-[186mm] px-0 text-[color:#000]"
          : mode === "projection"
            ? "mx-auto w-full max-w-[52ch] text-[color:var(--color-encre)]"
            : "mx-auto w-full max-w-[72ch] text-[color:var(--color-encre)]"
      }
    >
      <header>
        <h1 className={`m-0 font-bold tracking-[-0.02em] ${style.titre}`}>{document.titre}</h1>
        <div className="mt-3 h-px w-full bg-[color:var(--color-rose-decor)]" />
      </header>

      {entrees.length > 0 ? (
        <nav aria-label="Sommaire" className="mt-6 rounded-[var(--radius-champ)] bg-[color:var(--color-surface-douce)] p-4">
          <p className="m-0 text-[0.75em] font-semibold uppercase tracking-[0.08em] text-[color:var(--color-encre-faible)]">
            Sommaire
          </p>
          <ol className="m-0 mt-2 list-none space-y-1 p-0 text-[0.875em]">
            {entrees.map((entree) => (
              <li key={entree.index} style={{ paddingLeft: `${(entree.niveau - 1) * 1.1}em` }}>
                {entree.texte}
              </li>
            ))}
          </ol>
        </nav>
      ) : null}

      <div className={`mt-6 ${style.espace}`}>
        {document.blocs.map((bloc, index) => (
          <Bloc key={index} bloc={bloc} style={style} />
        ))}
      </div>
    </article>
  );
}

/* -------------------------------------------------------------------------- */

type Style = (typeof MODELES)[keyof typeof MODELES];

function Bloc({ bloc, style }: { bloc: BlocCours; style: Style }) {
  switch (bloc.type) {
    case "titre":
      return bloc.niveau === 1 ? (
        <h2 className={`m-0 mt-2 font-bold tracking-[-0.015em] ${style.sousTitre}`}>{bloc.texte}</h2>
      ) : bloc.niveau === 2 ? (
        <h3 className="m-0 text-[1.0625em] font-bold">{bloc.texte}</h3>
      ) : (
        <h4 className="m-0 text-[1em] font-semibold">{bloc.texte}</h4>
      );

    case "paragraphe":
      return <p className="m-0">{bloc.texte}</p>;

    case "encadre":
      return (
        <section className={style.encadre}>
          <p className="m-0 text-[0.8125em] font-semibold uppercase tracking-[0.06em] text-[color:var(--color-accent)]">
            {bloc.intitule}
          </p>
          {bloc.texte === "" ? null : <p className="m-0 mt-1.5">{bloc.texte}</p>}
        </section>
      );

    case "liste":
      return bloc.ordonnee ? (
        <ol className="m-0 list-decimal space-y-1 pl-6">
          {bloc.elements.map((element, i) => (
            <li key={i}>{element}</li>
          ))}
        </ol>
      ) : (
        <ul className="m-0 list-disc space-y-1 pl-6">
          {bloc.elements.map((element, i) => (
            <li key={i}>{element}</li>
          ))}
        </ul>
      );

    case "tableau":
      return (
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-[0.9375em]">
            <thead>
              <tr className="border-b-2 border-[color:var(--color-bordure-forte)] text-left">
                {bloc.entetes.map((entete, i) => (
                  <th key={i} scope="col" className="py-2 pr-4 font-semibold">
                    {entete}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {bloc.lignes.map((ligne, i) => (
                <tr key={i} className="border-b border-[color:var(--color-bordure)]">
                  {ligne.map((cellule, j) => (
                    <td key={j} className="py-2 pr-4 align-top">
                      {cellule}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );

    case "image":
      // L'image du document d'origine n'a pas été transférée. On garde sa place
      // et on le dit : une case vide et silencieuse laisserait croire à un
      // défaut d'affichage.
      return (
        <figure className="m-0">
          <div className="flex min-h-[7rem] items-center justify-center rounded-[var(--radius-champ)] border border-dashed border-[color:var(--color-bordure-forte)] p-5 text-center">
            <span className="text-[0.8125em] text-[color:var(--color-encre-tres-faible)]">
              {bloc.legende ?? "Emplacement d'une image du document d'origine"}
            </span>
          </div>
        </figure>
      );

    case "brut":
      // Fragment non reconnu, conservé mot pour mot. Mieux vaut un bloc mal
      // présenté qu'un paragraphe disparu.
      return (
        <p className="m-0 whitespace-pre-wrap text-[color:var(--color-encre-faible)]">
          {bloc.texte}
        </p>
      );
  }
}
