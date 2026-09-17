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
 * Les contenus sont fictifs et le disent : « Mme Bernard », « Seconde 1 ». Il
 * n'y a ici ni donnée réelle, ni nom de lycée, ni chiffre de clientèle.
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
      className={`overflow-hidden rounded-[var(--radius-carte)] border border-[color:var(--color-bordure)] bg-[color:var(--color-surface)] shadow-[var(--shadow-flottant)] ${className}`}
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
    <div className="hidden w-[132px] shrink-0 flex-col justify-between border-r border-[color:var(--color-bordure)] p-3 sm:flex">
      <div>
        <p className="marque m-0 mb-4 px-1.5 text-[0.9375rem]">AvecStudy.</p>
        <ul className="m-0 list-none space-y-0.5 p-0">
          {entrees.map((entree) => (
            <li
              key={entree}
              className={`rounded-md px-1.5 py-1.5 text-[0.6875rem] ${
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
        <div className="flex items-center gap-1.5 px-1 pt-3">
          <span className="flex h-5 w-5 items-center justify-center rounded-full bg-[color:var(--color-rose-clair)] text-[0.5rem] font-bold text-[color:var(--color-accent)]">
            {pied.nom
              .split(" ")
              .map((mot) => mot[0])
              .join("")
              .slice(0, 2)}
          </span>
          <span className="min-w-0">
            <span className="block truncate text-[0.625rem] font-semibold">{pied.nom}</span>
            <span className="block truncate text-[0.5rem] text-[color:var(--color-encre-tres-faible)]">
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
    <div className="rounded-lg border border-[color:var(--color-bordure)] p-2.5">
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

      <div className="min-w-0 flex-1 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="m-0 text-[0.9375rem] font-bold">Bonjour Rayan</p>
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

          <ul className="m-0 flex list-none flex-col justify-between gap-2 p-0">
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
/* L04 — le côté professeur                                                   */
/* -------------------------------------------------------------------------- */

export function ApercuProfesseur() {
  return (
    <Fenetre className="flex">
      <Laterale
        actif="Cours"
        entrees={["Accueil", "Cours", "Devoirs", "Élèves"]}
        pied={{ nom: "Mme Bernard", role: "Mathématiques" }}
      />

      <div className="min-w-0 flex-1 p-4">
        <div className="flex items-center gap-4 border-b border-[color:var(--color-bordure)] pb-2">
          <span className="border-b-2 border-[color:var(--color-accent)] pb-2 text-[0.75rem] font-semibold text-[color:var(--color-accent)]">
            Seconde 1
          </span>
          <span className="pb-2 text-[0.75rem] text-[color:var(--color-encre-faible)]">
            Seconde 2
          </span>
        </div>

        <div className="mt-3 flex items-start justify-between gap-3">
          <div>
            <p className="m-0 text-[0.5625rem] uppercase tracking-[0.08em] text-[color:var(--color-encre-tres-faible)]">
              Chapitre 3
            </p>
            <p className="m-0 mt-0.5 text-[0.875rem] font-bold">Fonctions affines</p>
          </div>
          <span className="rounded-md border border-[color:var(--color-bordure)] px-2 py-1 text-[0.625rem]">
            Modifier
          </span>
        </div>

        <ol className="m-0 mt-3 list-none space-y-1 p-0">
          {["Définition et exemples", "Représentation graphique", "Coefficient directeur", "Applications"].map(
            (ligne, i) => (
              <li
                key={ligne}
                className="flex items-center justify-between border-b border-[color:var(--color-bordure)] py-1.5 text-[0.75rem]"
              >
                <span>
                  <span className="mr-2 text-[color:var(--color-encre-tres-faible)]">{i + 1}.</span>
                  {ligne}
                </span>
                <span className="text-[color:var(--color-encre-tres-faible)]">›</span>
              </li>
            ),
          )}
        </ol>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <span className="inline-flex items-center rounded-md bg-[color:var(--color-encre)] px-3 py-2 text-[0.6875rem] font-semibold text-white">
            Publier le cours
          </span>
          <span className="text-[0.625rem] text-[color:var(--color-encre-tres-faible)]">
            Enregistré comme brouillon
          </span>
        </div>
      </div>
    </Fenetre>
  );
}

/* -------------------------------------------------------------------------- */
/* L06 — l'entraide                                                           */
/*                                                                            */
/* Cet aperçu reproduit la référence validée, conversation comprise. Décision  */
/* explicite du propriétaire du produit, prise après lui avoir signalé que le  */
/* chapitre 03 demande de n'illustrer que les capacités effectives et que la   */
/* messagerie entre élèves n'est pas encore livrée — seuls les groupes le      */
/* sont.                                                                      */
/*                                                                            */
/* Les prénoms et l'échange sont fictifs et le restent : aucune donnée réelle, */
/* aucun nom de lycée. Ce qui est montré est une maquette d'interface, comme   */
/* les autres aperçus de cette page.                                          */
/* -------------------------------------------------------------------------- */

const MESSAGES: readonly {
  readonly auteur: string;
  readonly heure: string;
  readonly texte: string;
  readonly calcul?: readonly string[];
}[] = [
  {
    auteur: "Lina",
    heure: "il y a 2 h",
    texte: "Je ne comprends pas la question 3… Quelqu'un peut m'expliquer ?",
  },
  {
    auteur: "Samir",
    heure: "il y a 1 h",
    texte: "Oui, regarde cet exemple ! On remplace x par 2 dans la fonction.",
    calcul: ["f(x) = 3x − 4", "f(2) = 3 × 2 − 4 = 2"],
  },
  {
    auteur: "Lina",
    heure: "il y a 1 h",
    texte: "Merci beaucoup ! C'est plus clair maintenant 🙏",
  },
];

export function ApercuEntraide() {
  return (
    <Fenetre className="p-4">
      <div className="flex items-center gap-4 border-b border-[color:var(--color-bordure)] pb-2 text-[0.75rem]">
        <span className="text-[color:var(--color-encre-faible)]">Devoir</span>
        <span className="text-[color:var(--color-encre-faible)]">Ma copie</span>
        <span className="border-b-2 border-[color:var(--color-accent)] pb-2 font-semibold text-[color:var(--color-accent)]">
          Entraide
        </span>
      </div>

      <div className="mt-3 grid gap-3 sm:grid-cols-[minmax(0,1.15fr)_minmax(0,0.85fr)]">
        <ul className="m-0 list-none space-y-2.5 p-0">
          {MESSAGES.map((message) => (
            <li key={message.auteur + message.heure} className="flex gap-2">
              <span
                aria-hidden="true"
                className="mt-0.5 h-5 w-5 shrink-0 rounded-full bg-[color:var(--color-rose-decor)]"
              />
              <span className="min-w-0">
                <span className="flex items-baseline gap-1.5">
                  <span className="text-[0.6875rem] font-semibold">{message.auteur}</span>
                  <span className="text-[0.5rem] text-[color:var(--color-encre-tres-faible)]">
                    {message.heure}
                  </span>
                </span>
                <span className="mt-0.5 block whitespace-pre-line text-[0.625rem] leading-snug text-[color:var(--color-encre-faible)]">
                  {message.texte}
                </span>
                {message.calcul === undefined ? null : (
                  <span className="mt-1.5 block rounded border border-[color:var(--color-bordure)] px-2 py-1.5 font-[family-name:var(--font-marque)] text-[0.5625rem] italic leading-relaxed">
                    {message.calcul.map((ligne) => (
                      <span key={ligne} className="block">
                        {ligne}
                      </span>
                    ))}
                  </span>
                )}
              </span>
            </li>
          ))}
        </ul>

        <div className="rounded-lg bg-[color:var(--color-rose-clair)] p-3">
          <p className="m-0 text-[0.5625rem] uppercase tracking-[0.08em] text-[color:var(--color-accent)]">
            Exercice 3
          </p>
          <p className="m-0 mt-1.5 text-[0.75rem] leading-relaxed">
            Soit la fonction affine <em>f</em> définie par <em>f</em>(x) = 3x − 4.
          </p>
          <ol className="m-0 mt-2 list-decimal space-y-0.5 pl-4 text-[0.6875rem] text-[color:var(--color-encre-faible)]">
            <li>Calculer f(2).</li>
            <li>Déterminer l&apos;antécédent de 5.</li>
          </ol>
        </div>
      </div>
    </Fenetre>
  );
}

/* -------------------------------------------------------------------------- */
/* L07 — l'import de la liste de classe                                       */
/* -------------------------------------------------------------------------- */

export function ApercuExcel() {
  const lignes = [
    ["Emma", "Laurent", "Seconde 1"],
    ["Rayan", "Benali", "Seconde 1"],
    ["Inès", "Moreau", "Seconde 2"],
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

      <table className="mt-3 w-full border-collapse text-[0.6875rem]">
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

      <div className="mt-3 flex justify-end">
        <span className="inline-flex items-center rounded-md bg-[color:var(--color-encre)] px-3 py-1.5 text-[0.625rem] font-semibold text-white">
          Créer les classes
        </span>
      </div>
    </Fenetre>
  );
}
