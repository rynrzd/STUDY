/**
 * Aperçus de la landing — cahier « Refonte fidèle », L02, L04, L06, L07.
 *
 * Ce sont des **images de l'interface, dessinées en HTML**, pas des captures et
 * pas des illustrations abstraites. Le cahier est net : l'aperçu du hero doit
 * montrer un vrai espace élève, avec le cours du jour, un devoir et une
 * correction. Une animation décorative à la place ne dit rien du produit.
 *
 * Aucun de ces composants n'est client : ils ne portent aucun état, donc aucun
 * JavaScript ne part dans le paquet public pour les afficher (P01).
 *
 * Les contenus sont fictifs et l'écran le dit : une mention « Aperçu fictif »
 * accompagne le premier d'entre eux. Les noms retenus — Camille Martin, Mme
 * Bernard, Lina, Samir, Inès — ne désignent personne ; aucun nom de lycée,
 * aucun identifiant et aucun chiffre de clientèle n'apparaissent nulle part.
 */

/* -------------------------------------------------------------------------- */
/* Châssis commun                                                             */
/* -------------------------------------------------------------------------- */

function Fenetre({
  children,
  className = "",
}: {
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <div
      aria-hidden="true"
      className={`apercu-releve w-full max-w-full min-w-0 overflow-hidden rounded-[var(--radius-carte)] border border-[color:var(--color-bordure)] bg-[color:var(--color-surface)] shadow-[var(--shadow-flottant)] ${className}`}
    >
      {children}
    </div>
  );
}

function Laterale({
  actif,
  entrees,
  pied,
}: {
  actif: string;
  entrees: readonly string[];
  pied?: { nom: string; role: string };
}) {
  return (
    <div className="flex w-[84px] shrink-0 flex-col justify-between border-r border-[color:var(--color-bordure)] p-2 sm:w-[132px] sm:p-3">
      <div>
        <p className="marque m-0 mb-3 px-1 text-[0.75rem] sm:mb-4 sm:px-1.5 sm:text-[0.9375rem]">
          AvecStudy.
        </p>
        <ul className="m-0 list-none space-y-0.5 p-0">
          {entrees.map((entree) => (
            <li
              key={entree}
              className={`truncate rounded-md px-1 py-1 text-[0.5625rem] sm:px-1.5 sm:py-1.5 sm:text-[0.6875rem] ${
                entree === actif
                  ? "bg-[color:var(--color-rose-clair)] font-semibold text-[color:var(--color-accent)]"
                  : "text-[color:var(--color-encre-faible)]"
              }`}
            >
              {entree}
            </li>
          ))}
        </ul>
      </div>
      {pied ? (
        <div className="flex items-center gap-1.5 px-0.5 pt-3 sm:px-1">
          <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[color:var(--color-rose-clair)] text-[0.4375rem] font-bold text-[color:var(--color-accent)] sm:h-5 sm:w-5 sm:text-[0.5rem]">
            {pied.nom
              .split(" ")
              .map((mot) => mot[0])
              .join("")
              .slice(0, 2)}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-[0.5rem] font-semibold sm:text-[0.625rem]">{pied.nom}</span>
            <span className="hidden truncate text-[0.5rem] text-[color:var(--color-encre-tres-faible)] sm:block">
              {pied.role}
            </span>
          </span>
        </div>
      ) : null}
    </div>
  );
}

function Carte({
  titre,
  detail,
  marque,
  accent = false,
}: {
  titre: string;
  detail: string;
  marque?: string;
  accent?: boolean;
}) {
  return (
    <div className="min-w-0 rounded-lg border border-[color:var(--color-bordure)] p-2.5">
      <p className="m-0 text-[0.5625rem] uppercase tracking-[0.08em] text-[color:var(--color-encre-tres-faible)]">
        {titre}
      </p>
      <p
        className={`m-0 mt-1 text-[0.75rem] font-semibold ${
          accent ? "text-[color:var(--color-accent)]" : ""
        }`}
      >
        {detail}
      </p>
      {marque ? (
        <p className="m-0 mt-1 text-[0.625rem] text-[color:var(--color-encre-faible)]">{marque}</p>
      ) : null}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* L02 — l'espace d'un élève                                                  */
/* -------------------------------------------------------------------------- */

export function ApercuEleve() {
  return (
    <Fenetre className="flex">
      <Laterale
        actif="Accueil"
        entrees={["Accueil", "Cours", "Devoirs", "Entraide", "Messagerie"]}
        pied={{ nom: "Mon profil", role: "Seconde 1" }}
      />

      <div className="min-w-0 flex-1 p-3 sm:p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="m-0 text-[0.9375rem] font-bold">Bonjour Camille</p>
            <p className="m-0 mt-0.5 text-[0.6875rem] text-[color:var(--color-encre-faible)]">
              Seconde 1 ▾
            </p>
          </div>
          <span className="flex items-center gap-2">
            <span className="text-[0.75rem] text-[color:var(--color-encre-tres-faible)]">⌁</span>
            <span className="h-6 w-6 rounded-full bg-[color:var(--color-rose-decor)]" />
          </span>
        </div>

        {/* Le bandeau du haut, et à sa droite la colonne de notes : c'est la
            composition de la référence, et elle a une raison — l'élève voit
            d'abord où il en est, puis ce qu'on lui dit. */}
        <div className="mt-3 grid gap-2 sm:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
          <div className="flex min-h-[86px] items-end rounded-lg bg-gradient-to-br from-[color:var(--color-rose-clair)] to-[color:var(--color-rose-decor)] p-3">
            <p className="m-0 max-w-[16ch] text-[0.8125rem] font-semibold leading-snug">
              Une nouvelle semaine pour aller plus loin.
            </p>
          </div>

          <ul className="m-0 flex min-w-0 list-none flex-col justify-between gap-2 p-0">
            {[
              "Les efforts d'aujourd'hui font les réussites de demain.",
              "Une question vaut mieux qu'un blanc.",
            ].map((note) => (
              <li
                key={note}
                className="flex-1 rounded-lg border border-[color:var(--color-bordure)] p-2 text-[0.5625rem] leading-snug text-[color:var(--color-encre-faible)]"
              >
                « {note} »
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-2 grid gap-2 sm:grid-cols-2">
          <Carte titre="Cours du jour" detail="Fonctions affines" marque="Mathématiques" />
          <Carte titre="Devoir à rendre" detail="Exercices n° 3 à 5" marque="Pour demain" accent />
        </div>

        <div className="mt-2 flex items-center justify-between gap-3 rounded-lg border border-[color:var(--color-bordure)] p-2.5">
          <span className="min-w-0">
            <span className="block text-[0.5625rem] uppercase tracking-[0.08em] text-[color:var(--color-succes)]">
              Correction reçue
            </span>
            <span className="mt-0.5 block truncate text-[0.75rem] font-semibold">
              Physique-chimie — DM n° 2
            </span>
          </span>
          <span className="whitespace-nowrap text-[0.625rem] font-semibold text-[color:var(--color-accent)]">
            Voir la correction →
          </span>
        </div>
      </div>
    </Fenetre>
  );
}

/* -------------------------------------------------------------------------- */
/* L03 — les trois situations d'usage                                         */
/* -------------------------------------------------------------------------- */

export function ApercuOrdinateur() {
  return (
    <Fenetre className="p-4">
      <p className="m-0 text-[0.6875rem] uppercase tracking-[0.08em] text-[color:var(--color-encre-tres-faible)]">
        Séance du jour
      </p>
      <p className="m-0 mt-1 text-[0.9375rem] font-bold">Fonctions affines</p>
      <ul className="m-0 mt-3 list-none space-y-1.5 p-0">
        {["Définition et exemples", "Représentation graphique", "Exercices 1 à 4"].map((ligne, i) => (
          <li
            key={ligne}
            className="flex items-center justify-between rounded-md border border-[color:var(--color-bordure)] px-2.5 py-2 text-[0.75rem]"
          >
            <span>
              <span className="mr-2 text-[color:var(--color-encre-tres-faible)]">{i + 1}.</span>
              {ligne}
            </span>
            <span className="text-[color:var(--color-encre-tres-faible)]">→</span>
          </li>
        ))}
      </ul>
    </Fenetre>
  );
}

export function ApercuPapier() {
  return (
    <Fenetre className="p-4">
      <div className="rounded-md bg-[color:var(--color-encre)] px-3 py-5 text-center">
        <p className="m-0 text-[1.125rem] font-bold text-white">Fonctions affines</p>
        <p className="m-0 mt-1 text-[0.6875rem] text-white/70">Mode projection</p>
      </div>
      <p className="m-0 mt-3 text-[0.75rem] leading-relaxed text-[color:var(--color-encre-faible)]">
        Le professeur projette la séance. Les élèves écrivent sur leur cahier.
        Les documents restent disponibles après le cours.
      </p>
    </Fenetre>
  );
}

export function ApercuMaison() {
  return (
    <Fenetre className="p-4">
      <ul className="m-0 list-none space-y-2 p-0">
        <Carte titre="Le cours" detail="Fonctions affines" marque="Publié aujourd'hui" />
        <Carte titre="Le devoir" detail="Exercices n° 3 à 5" marque="Pour demain" accent />
        <Carte titre="La correction" detail="DM n° 2" marque="Disponible" />
      </ul>
    </Fenetre>
  );
}

/* -------------------------------------------------------------------------- */
/* L07 — l'import de la liste de classe                                       */
/* -------------------------------------------------------------------------- */

export function ApercuExcel() {
  const lignes = [
    ["Lina", "Dubois", "Seconde 1"],
    ["Camille", "Martin", "Seconde 1"],
    ["Samir", "Nadir", "Seconde 2"],
  ];

  return (
    <Fenetre className="p-4">
      <div className="flex items-center justify-between gap-3">
        <span className="flex items-center gap-2">
          <span className="flex h-6 w-6 items-center justify-center rounded bg-[color:var(--color-succes-fond)] text-[0.625rem] font-bold text-[color:var(--color-succes)]">
            X
          </span>
          <span>
            <span className="block text-[0.75rem] font-semibold">Eleves.xlsx</span>
            <span className="block text-[0.5625rem] text-[color:var(--color-encre-tres-faible)]">
              3 élèves détectés
            </span>
          </span>
        </span>
        <span className="rounded-md border border-[color:var(--color-bordure)] px-2 py-1 text-[0.625rem]">
          Remplacer
        </span>
      </div>

      {/* Un tableau ne retrecit pas en dessous de son contenu : sans ce cadre
          a defilement, c'est lui qui pousse toute la page au-dela de l'ecran
          d'un telephone. Le seul element de la landing autorise a defiler. */}
      <div className="sans-barre mt-3 overflow-x-auto">
      <table className="w-full min-w-[15rem] border-collapse text-[0.6875rem]">
        <thead>
          <tr className="border-b border-[color:var(--color-bordure-forte)] text-left">
            <th className="py-1.5 font-semibold">Prénom</th>
            <th className="py-1.5 font-semibold">Nom</th>
            <th className="py-1.5 font-semibold">Classe</th>
          </tr>
        </thead>
        <tbody>
          {lignes.map((ligne) => (
            <tr key={ligne[1]} className="border-b border-[color:var(--color-bordure)]">
              <td className="py-1.5">{ligne[0]}</td>
              <td className="py-1.5">{ligne[1]}</td>
              <td className="py-1.5 text-[color:var(--color-encre-faible)]">{ligne[2]}</td>
            </tr>
          ))}
        </tbody>
      </table>
      </div>

      <div className="mt-3 flex justify-end">
        <span className="inline-flex items-center rounded-md bg-[color:var(--color-encre)] px-3 py-1.5 text-[0.625rem] font-semibold text-white">
          Créer les classes
        </span>
      </div>
    </Fenetre>
  );
}

/* -------------------------------------------------------------------------- */
/* §2.2 et §2.4 — les fragments du téléphone                                  */
/*                                                                            */
/* Ce qui précède est une fenêtre : un cadre, une barre latérale, plusieurs   */
/* colonnes. C'est juste sur un écran large, et faux sur un téléphone — le    */
/* cahier le dit en toutes lettres : « remplacer l'aperçu par des fragments   */
/* mobiles compacts sans sidebar », « aucun panneau desktop compressé ».      */
/*                                                                            */
/* Ce ne sont donc pas les mêmes composants réduits. Ce sont deux morceaux    */
/* d'écran, à la taille où on les lit vraiment : ce que l'élève a aujourd'hui,*/
/* et ce qu'il lui reste à faire. Pas de cadre de fenêtre, pas de navigation, */
/* pas de faux chiffre.                                                       */
/* -------------------------------------------------------------------------- */

function EtiquetteFragment({ texte }: { texte: string }) {
  return (
    <p className="m-0 text-[0.6875rem] font-semibold uppercase tracking-[0.1em] text-[color:var(--color-encre-tres-faible)]">
      {texte}
    </p>
  );
}

/** « Aujourd'hui » : une séance, celle du jour. Rien d'autre. */
function FragmentAujourdhui() {
  return (
    <div className="rounded-[var(--radius-carte)] border border-[color:var(--color-bordure)] bg-[color:var(--color-surface)] p-4">
      <EtiquetteFragment texte="Aujourd'hui" />

      <p className="m-0 mt-2.5 text-[1.0625rem] font-bold leading-snug">Fonctions affines</p>
      <p className="m-0 mt-1 text-[0.8125rem] text-[color:var(--color-encre-faible)]">
        Mathématiques · Mme Bernard
      </p>

      <div className="mt-3 flex items-center gap-2 border-t border-[color:var(--color-bordure)] pt-3">
        <span
          aria-hidden="true"
          className="h-1.5 w-1.5 shrink-0 rounded-full bg-[color:var(--color-succes)]"
        />
        <span className="text-[0.8125rem] text-[color:var(--color-encre-faible)]">
          Le cours et ses exercices sont en ligne
        </span>
      </div>
    </div>
  );
}

/**
 * « À faire » : deux lignes, et une case qui tient.
 *
 * La case barrée n'est pas un ornement : c'est l'état persistant du §3.3, et
 * c'est la seule chose que le produit retient d'un travail personnel. Pas de
 * score, pas de série de jours, pas de pourcentage.
 */
function FragmentAFaire() {
  const travaux = [
    { titre: "Exercices n° 3 à 5", cours: "Mathématiques", quand: "Pour demain", fait: false },
    { titre: "Lire le chapitre 4", cours: "Histoire", quand: "Vendredi", fait: true },
  ] as const;

  return (
    <div className="rounded-[var(--radius-carte)] border border-[color:var(--color-bordure)] bg-[color:var(--color-surface)] p-4">
      <EtiquetteFragment texte="À faire" />

      <ul className="m-0 mt-2 list-none p-0">
        {travaux.map((travail) => (
          <li
            key={travail.titre}
            className="flex items-center gap-3 border-b border-[color:var(--color-bordure)] py-2.5 last:border-b-0 last:pb-0"
          >
            <span
              aria-hidden="true"
              className={`grid h-5 w-5 shrink-0 place-items-center rounded-[5px] border text-[0.625rem] font-bold ${
                travail.fait
                  ? "border-[color:var(--color-succes)] bg-[color:var(--color-succes)] text-white"
                  : "border-[color:var(--color-bordure-forte)]"
              }`}
            >
              {travail.fait ? "✓" : ""}
            </span>

            <span className="min-w-0 flex-1">
              <span
                className={`block truncate text-[0.875rem] font-semibold ${
                  travail.fait ? "text-[color:var(--color-encre-faible)] line-through" : ""
                }`}
              >
                {travail.titre}
              </span>
              <span className="mt-0.5 block text-[0.75rem] text-[color:var(--color-encre-faible)]">
                {travail.cours} · {travail.quand}
              </span>
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

/**
 * Les fragments du hero, sur téléphone.
 *
 * Deux morceaux, empilés, à la largeur du pouce. Ils ne remplacent pas la
 * fenêtre d'aperçu : ils la remplacent **là où elle ne va pas**, c'est-à-dire
 * sous 1024 pixels. Au-dessus, la fenêtre reprend sa place.
 */
export function FragmentsEleve() {
  return (
    <div className="grid gap-3 min-[560px]:grid-cols-2">
      <FragmentAujourdhui />
      <FragmentAFaire />
    </div>
  );
}
