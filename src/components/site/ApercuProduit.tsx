/**
 * Aperçu du produit — section 3 de la landing.
 *
 * Le cahier de finition demande une capture réelle et nette de l'interface.
 * Tant qu'elle n'existe pas, il autorise « un composant produit fidèle
 * alimenté par des données de démonstration clairement identifiées ». C'est ce
 * que fait ce composant : il reprend la structure exacte de l'espace connecté
 * — barre latérale des classes, séance ouverte, travail à rendre — et les
 * données affichées sont annoncées comme des données de démonstration.
 *
 * Deux règles tenues ici :
 * - aucun chiffre inventé n'est présenté comme une statistique du produit ;
 * - aucun élément n'est cliquable : ce n'est pas une fausse application.
 *
 * Quand la capture réelle sera disponible, remplacer ce composant par l'image
 * et supprimer le fichier.
 */

const CLASSES = [
  { label: "Première 3", matiere: "Mathématiques", actif: true },
  { label: "Première 5", matiere: "Mathématiques", actif: false },
  { label: "Terminale 2", matiere: "Mathématiques", actif: false },
  { label: "Seconde 7", matiere: "Mathématiques", actif: false },
] as const;

const SEANCE = {
  chapitre: "Chapitre 4 — Suites",
  titre: "Suites géométriques : raison et sens de variation",
  date: "Séance du jeudi 11 septembre",
  blocs: [
    { type: "Cours", titre: "Définition et premières propriétés", meta: "3 pages" },
    { type: "Exercice", titre: "Exercices 12 à 18, page 74", meta: "En classe" },
    { type: "Devoir", titre: "Devoir maison n° 2", meta: "À rendre le 18 septembre" },
  ],
} as const;

const REMISES = [
  { nom: "Groupe A", etat: "14 copies remises", ton: "ok" },
  { nom: "Groupe B", etat: "3 copies en attente", ton: "attente" },
] as const;

export function ApercuProduit() {
  return (
    <div className="relative">
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_268px] lg:items-end">
        <FenetreBureau />
        <FenetreMobile />
      </div>

      <p className="mt-6 text-[length:var(--text-aide)] leading-[var(--text-aide--line-height)] text-[color:var(--color-encre-faible)]">
        Interface AvecStudy. Les noms de classes, de chapitres et les états
        affichés sont des <strong className="font-semibold">données de démonstration</strong>.
      </p>
    </div>
  );
}

/* -------------------------------------------------------------------------- */

function FenetreBureau() {
  return (
    <div
      aria-hidden="true"
      className="overflow-hidden rounded-[var(--radius-carte)] border border-[color:var(--color-bordure)] bg-[color:var(--color-surface)] shadow-[var(--shadow-carte)]"
    >
      <BarreFenetre />

      <div className="grid grid-cols-[168px_minmax(0,1fr)] md:grid-cols-[204px_minmax(0,1fr)]">
        {/* Barre latérale */}
        <aside className="border-r border-[color:var(--color-bordure)] bg-[color:var(--color-surface-douce)] p-4">
          <p className="m-0 text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-[color:var(--color-encre-faible)]">
            Mes classes
          </p>
          <ul className="m-0 mt-3 list-none space-y-1 p-0">
            {CLASSES.map((classe) => (
              <li
                key={classe.label}
                className={`rounded-[8px] px-2.5 py-2 text-[0.8125rem] ${
                  classe.actif
                    ? "bg-[color:var(--color-accent-doux)] font-semibold text-[color:var(--color-accent)]"
                    : "text-[color:var(--color-encre-faible)]"
                }`}
              >
                <span className="block">{classe.label}</span>
                <span className="block text-[0.6875rem] opacity-80">{classe.matiere}</span>
              </li>
            ))}
          </ul>

          <p className="m-0 mt-6 text-[0.6875rem] font-semibold uppercase tracking-[0.08em] text-[color:var(--color-encre-faible)]">
            Établissement
          </p>
          <p className="m-0 mt-2 text-[0.8125rem] text-[color:var(--color-encre-faible)]">
            Lycée de démonstration
          </p>
        </aside>

        {/* Contenu */}
        <div className="p-5 md:p-7">
          <p className="m-0 text-[0.75rem] font-semibold uppercase tracking-[0.08em] text-[color:var(--color-accent)]">
            {SEANCE.chapitre}
          </p>
          <h3 className="mt-2 text-[1.0625rem] leading-[1.5rem] md:text-[1.25rem] md:leading-[1.7rem]">
            {SEANCE.titre}
          </h3>
          <p className="m-0 mt-1.5 text-[0.8125rem] text-[color:var(--color-encre-faible)]">
            {SEANCE.date} · Première 3 · publiée
          </p>

          <ul className="m-0 mt-5 list-none space-y-2.5 p-0">
            {SEANCE.blocs.map((bloc) => (
              <li
                key={bloc.titre}
                className="flex items-center justify-between gap-4 rounded-[10px] border border-[color:var(--color-bordure)] px-3.5 py-3"
              >
                <span className="min-w-0">
                  <span className="block text-[0.6875rem] font-semibold uppercase tracking-[0.06em] text-[color:var(--color-encre-faible)]">
                    {bloc.type}
                  </span>
                  <span className="mt-0.5 block truncate text-[0.875rem] font-medium">
                    {bloc.titre}
                  </span>
                </span>
                <span className="shrink-0 text-[0.75rem] text-[color:var(--color-encre-faible)]">
                  {bloc.meta}
                </span>
              </li>
            ))}
          </ul>

          <div className="mt-5 flex flex-wrap gap-2.5 border-t border-[color:var(--color-bordure)] pt-5">
            {REMISES.map((remise) => (
              <span
                key={remise.nom}
                className={`inline-flex items-center gap-2 rounded-full px-3 py-1.5 text-[0.75rem] font-medium ${
                  remise.ton === "ok"
                    ? "bg-[color:var(--color-succes-fond)] text-[color:var(--color-succes)]"
                    : "bg-[color:var(--color-surface-douce)] text-[color:var(--color-encre-faible)]"
                }`}
              >
                {remise.nom} — {remise.etat}
              </span>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function FenetreMobile() {
  return (
    <div
      aria-hidden="true"
      className="mx-auto hidden w-[268px] overflow-hidden rounded-[26px] border border-[color:var(--color-bordure)] bg-[color:var(--color-surface)] p-2 shadow-[var(--shadow-carte)] lg:block"
    >
      <div className="overflow-hidden rounded-[20px] border border-[color:var(--color-bordure)]">
        <div className="flex items-center justify-between bg-[color:var(--color-surface-douce)] px-4 py-2.5">
          <span className="text-[0.8125rem] font-extrabold tracking-[-0.03em]">AvecStudy</span>
          <span className="text-[0.6875rem] text-[color:var(--color-encre-faible)]">
            Première 3
          </span>
        </div>

        <div className="p-4">
          <p className="m-0 text-[0.625rem] font-semibold uppercase tracking-[0.08em] text-[color:var(--color-accent)]">
            À faire
          </p>
          <ul className="m-0 mt-2.5 list-none space-y-2 p-0">
            <li className="rounded-[10px] border border-[color:var(--color-bordure)] p-3">
              <span className="block text-[0.8125rem] font-medium">Devoir maison n° 2</span>
              <span className="mt-1 block text-[0.6875rem] text-[color:var(--color-encre-faible)]">
                À rendre le 18 septembre
              </span>
            </li>
            <li className="rounded-[10px] border border-[color:var(--color-bordure)] p-3">
              <span className="block text-[0.8125rem] font-medium">Exercices 12 à 18</span>
              <span className="mt-1 block text-[0.6875rem] text-[color:var(--color-encre-faible)]">
                Séance du 11 septembre
              </span>
            </li>
          </ul>

          <p className="m-0 mt-5 text-[0.625rem] font-semibold uppercase tracking-[0.08em] text-[color:var(--color-encre-faible)]">
            Dernière séance
          </p>
          <p className="m-0 mt-1.5 text-[0.8125rem] leading-[1.15rem]">
            Suites géométriques : raison et sens de variation
          </p>
        </div>
      </div>
    </div>
  );
}

function BarreFenetre() {
  return (
    <div className="flex items-center gap-3 border-b border-[color:var(--color-bordure)] bg-[color:var(--color-surface-douce)] px-4 py-2.5">
      <span className="flex gap-1.5">
        <span className="block size-2.5 rounded-full bg-[color:var(--color-bordure-forte)]" />
        <span className="block size-2.5 rounded-full bg-[color:var(--color-bordure-forte)]" />
        <span className="block size-2.5 rounded-full bg-[color:var(--color-bordure-forte)]" />
      </span>
      <span className="ml-2 rounded-[6px] bg-[color:var(--color-surface)] px-2.5 py-1 text-[0.6875rem] text-[color:var(--color-encre-faible)]">
        avecstudy.fr/classes/premiere-3
      </span>
    </div>
  );
}
