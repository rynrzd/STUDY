/**
 * Aperçus d'interface pour le site public.
 *
 * Le ch. 04 demande une véritable capture de l'interface réalisée. Elle
 * n'existe pas encore : ces aperçus sont donc des maquettes **explicitement
 * présentées comme telles**, comme le cahier des charges l'autorise pendant le
 * développement. Chacune est enveloppée dans <Aperçu>, qui affiche la mention.
 *
 * Règle tenue ici : aucune de ces maquettes ne montre une fonction absente du
 * produit. L'entrée « Messagerie » de la maquette de référence est rendue
 * comme « Entraide », parce que study. n'a pas de messagerie libre (ch. 17 et
 * ch. 43). Les noms, dates et contenus sont fictifs.
 */

const CADRE =
  "overflow-hidden rounded-[var(--radius-carte)] border border-[color:var(--color-bordure)] " +
  "bg-[color:var(--color-surface)] shadow-[var(--shadow-carte)]";

export function Apercu({
  children,
  legende,
  className,
}: {
  children: React.ReactNode;
  legende: string;
  className?: string;
}) {
  return (
    <figure className={`m-0 ${className ?? ""}`}>
      <div className={CADRE} aria-hidden="true">
        {children}
      </div>
      <figcaption className="mt-3 text-[length:var(--text-aide)] leading-[var(--text-aide--line-height)] text-[color:var(--color-encre-faible)]">
        Aperçu de l&apos;interface en construction — {legende}. Maquette, pas une
        capture : noms, dates et contenus sont fictifs.
      </figcaption>
    </figure>
  );
}

/* -------------------------------------------------------------------------- */
/* Éléments communs aux maquettes                                             */
/* -------------------------------------------------------------------------- */

function Rail({ actif }: { actif: string }) {
  const entrees = ["Accueil", "Cours", "Devoirs", "Entraide", "Révisions"];
  return (
    <nav className="hidden w-[132px] shrink-0 border-r border-[color:var(--color-bordure)] p-3 sm:block">
      <p className="mot-symbole m-0 px-2 pb-4 text-lg">study.</p>
      <ul className="m-0 list-none space-y-1 p-0 text-[length:var(--text-aide)]">
        {entrees.map((entree) => (
          <li
            key={entree}
            className={`rounded-[6px] px-2 py-1.5 ${
              entree === actif
                ? "bg-[color:var(--color-rose-selection)] font-semibold"
                : "text-[color:var(--color-encre-faible)]"
            }`}
          >
            {entree}
          </li>
        ))}
      </ul>
    </nav>
  );
}

function Pastille({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex h-6 w-6 items-center justify-center rounded-full bg-[color:var(--color-rose-selection)] text-[11px] font-semibold">
      {children}
    </span>
  );
}

/* -------------------------------------------------------------------------- */
/* Aperçu principal du hero : la journée d'un élève                           */
/* -------------------------------------------------------------------------- */

export function ApercuEleve() {
  return (
    <div className="flex min-h-[420px] text-[length:var(--text-aide)] leading-[var(--text-aide--line-height)]">
      <Rail actif="Accueil" />

      <div className="flex-1 p-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="m-0 text-base font-semibold">Bonjour Rayan</p>
            <p className="m-0 text-[color:var(--color-encre-faible)]">Seconde 1</p>
          </div>
          <Pastille>R</Pastille>
        </div>

        <div className="mt-4 rounded-[var(--radius-carte)] bg-[color:var(--color-rose-selection)] p-4">
          <p className="m-0 font-semibold">Une nouvelle semaine pour aller plus loin.</p>
          <p className="mt-1 m-0 text-[color:var(--color-encre-faible)]">
            Trois séances publiées, un devoir à rendre.
          </p>
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <div className="rounded-[var(--radius-carte)] border border-[color:var(--color-bordure)] p-3">
            <p className="m-0 text-[color:var(--color-encre-faible)]">Cours du jour</p>
            <p className="mt-1 m-0 font-semibold">Mathématiques</p>
            <p className="m-0">Fonctions affines</p>
          </div>
          <div className="rounded-[var(--radius-carte)] border border-[color:var(--color-bordure)] p-3">
            <p className="m-0 text-[color:var(--color-encre-faible)]">Devoir à rendre demain</p>
            <p className="mt-1 m-0 font-semibold">Exercices n°3 à 6</p>
            <p className="m-0">Seconde 1</p>
          </div>
        </div>

        <div className="mt-3 flex items-center gap-3 rounded-[var(--radius-carte)] border border-[color:var(--color-bordure)] p-3">
          <span
            className="inline-flex h-6 w-6 shrink-0 items-center justify-center rounded-full text-[11px] font-semibold text-white"
            style={{ background: "var(--color-succes)" }}
          >
            ✓
          </span>
          <div className="min-w-0">
            <p className="m-0 font-semibold">Correction reçue</p>
            <p className="m-0 truncate text-[color:var(--color-encre-faible)]">
              Physique-chimie — DM n°2
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Aperçu enseignant : deux classes, deux progressions                        */
/* -------------------------------------------------------------------------- */

export function ApercuProfesseur() {
  const etapes = [
    ["1", "Définition et exemples"],
    ["2", "Représentation graphique"],
    ["3", "Coefficient directeur"],
    ["4", "Applications"],
  ] as const;

  return (
    <div className="flex min-h-[420px] text-[length:var(--text-aide)] leading-[var(--text-aide--line-height)]">
      <Rail actif="Cours" />

      <div className="flex-1 p-4">
        <div className="flex items-center justify-between">
          <div className="flex gap-1">
            <span className="rounded-[6px] bg-[color:var(--color-rose-selection)] px-3 py-1.5 font-semibold">
              Seconde 1
            </span>
            <span className="rounded-[6px] px-3 py-1.5 text-[color:var(--color-encre-faible)]">
              Seconde 2
            </span>
          </div>
          <Pastille>M</Pastille>
        </div>

        <div className="mt-4 rounded-[var(--radius-carte)] border border-[color:var(--color-bordure)]">
          <div className="flex items-center justify-between border-b border-[color:var(--color-bordure)] p-3">
            <div>
              <p className="m-0 text-[color:var(--color-encre-faible)]">Chapitre 2</p>
              <p className="m-0 font-semibold">Fonctions affines</p>
            </div>
            <span className="rounded-[6px] border border-[color:var(--color-bordure)] px-2 py-1 text-[color:var(--color-encre-faible)]">
              Modifier
            </span>
          </div>
          <ul className="m-0 list-none p-0">
            {etapes.map(([numero, libelle]) => (
              <li
                key={numero}
                className="flex items-center gap-3 border-b border-[color:var(--color-bordure)] px-3 py-2 last:border-b-0"
              >
                <span className="text-[color:var(--color-encre-faible)]">{numero}.</span>
                <span>{libelle}</span>
              </li>
            ))}
          </ul>
        </div>

        <div className="mt-4 flex flex-wrap items-center gap-3">
          <span className="inline-flex min-h-[36px] items-center rounded-[var(--radius-champ)] bg-[color:var(--color-encre)] px-4 text-[color:var(--color-surface)]">
            Publier le cours
          </span>
          <span className="text-[color:var(--color-encre-faible)] underline">
            Enregistrer comme brouillon
          </span>
        </div>

        <p className="mt-4 m-0 rounded-[var(--radius-carte)] bg-[color:var(--color-fond)] p-3 text-[color:var(--color-encre-faible)]">
          Cette séance sera publiée uniquement pour la classe Seconde 1. Elle
          n&apos;est pas partagée avec vos autres classes.
        </p>
      </div>
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* Aperçu élèves : la copie et l'entraide, séparées                           */
/* -------------------------------------------------------------------------- */

export function ApercuEntraide() {
  const messages = [
    ["Lina", "10 h 24", "Je ne comprends pas la question 2."],
    ["Samir", "10 h 27", "Regarde l'exemple 1 : on remplace x par 2 dans la fonction."],
    ["Lina", "10 h 31", "Merci, c'est plus clair maintenant."],
  ] as const;

  return (
    <div className="min-h-[380px] p-4 text-[length:var(--text-aide)] leading-[var(--text-aide--line-height)]">
      <div className="flex gap-1 border-b border-[color:var(--color-bordure)] pb-2">
        <span className="rounded-[6px] px-3 py-1.5 text-[color:var(--color-encre-faible)]">Devoir</span>
        <span className="rounded-[6px] px-3 py-1.5 text-[color:var(--color-encre-faible)]">Ma copie</span>
        <span className="rounded-[6px] bg-[color:var(--color-rose-selection)] px-3 py-1.5 font-semibold">
          Entraide
        </span>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-[1fr_200px]">
        <ul className="m-0 list-none space-y-3 p-0">
          {messages.map(([auteur, heure, texte]) => (
            <li key={`${auteur}-${heure}`} className="flex gap-3">
              <Pastille>{auteur[0]}</Pastille>
              <div className="min-w-0">
                <p className="m-0">
                  <span className="font-semibold">{auteur}</span>{" "}
                  <span className="text-[color:var(--color-encre-faible)]">{heure}</span>
                </p>
                <p className="m-0">{texte}</p>
              </div>
            </li>
          ))}
        </ul>

        <div className="rounded-[var(--radius-carte)] bg-[color:var(--color-rose-selection)] p-3">
          <p className="m-0 font-semibold">Exercice 3</p>
          <p className="mt-2 m-0">
            Soit la fonction affine <i>f</i> définie par <i>f</i>(x) = 3x − 4.
          </p>
          <ol className="mt-2 mb-0 space-y-1 pl-4">
            <li>Calculer f(2).</li>
            <li>Déterminer l&apos;antécédent de 5.</li>
          </ol>
        </div>
      </div>

      <p className="mt-4 m-0 border-t border-[color:var(--color-bordure)] pt-3 text-[color:var(--color-encre-faible)]">
        Espace d&apos;entraide entre élèves. Les signalements peuvent être
        examinés par un modérateur.
      </p>
    </div>
  );
}
