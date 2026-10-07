import { CheckCircle2, FileText, Users } from "lucide-react";

/**
 * Exemples de la vitrine — R2, §04.
 *
 * Ce sont des **illustrations** : aucun service, aucune donnée de session,
 * aucune action. Chacune porte sa mention « exemple » au-dessus ou au-dessous,
 * et rien n'y ressemble à un bouton actif. Le graphique est un SVG calculé
 * (f(x) = 2x + 1), exact par construction.
 */

export function MentionExemple({ children }: { children: React.ReactNode }) {
  return <p className="m-0 text-[0.8125rem] font-semibold text-[color:var(--color-encre-faible)]">{children}</p>;
}

/** Graphique exact de f(x) = 2x + 1 sur [-1 ; 3]. */
function GraphiqueAffine() {
  // Repère : x ∈ [-1, 3], y ∈ [-1, 7] ; 1 unité = 22 px en x, 14 px en y.
  const X = (x: number) => 30 + (x + 1) * 44;
  const Y = (y: number) => 116 - (y + 1) * 13;
  return (
    <svg viewBox="0 0 220 128" className="h-auto w-full max-w-[260px]" role="img" aria-label="Droite représentant f(x) = 2x + 1, passant par (0 ; 1) et (3 ; 7)">
      <line x1={X(-1)} y1={Y(0)} x2={X(3)} y2={Y(0)} stroke="#d3c9d2" strokeWidth="1" />
      <line x1={X(0)} y1={Y(-1)} x2={X(0)} y2={Y(7)} stroke="#d3c9d2" strokeWidth="1" />
      {[1, 2, 3].map((x) => (
        <text key={x} x={X(x)} y={Y(0) + 12} fontSize="9" textAnchor="middle" fill="#64616d">{x}</text>
      ))}
      <line x1={X(-1)} y1={Y(-1)} x2={X(3)} y2={Y(7)} stroke="#81445b" strokeWidth="2.5" strokeLinecap="round" />
      <circle cx={X(0)} cy={Y(1)} r="3.5" fill="#81445b" />
      <circle cx={X(3)} cy={Y(7)} r="3.5" fill="#81445b" />
      <text x={X(0) + 6} y={Y(1) + 4} fontSize="9" fill="#29282e">(0 ; 1)</text>
      <text x={X(3) - 6} y={Y(7) + 4} fontSize="9" textAnchor="end" fill="#29282e">(3 ; 7)</text>
    </svg>
  );
}

/** L02 — une fiche de cours lisible, pas un tableau de bord. */
export function ExempleCours() {
  return (
    <figure className="m-0 rounded-[var(--radius-grand)] bg-[color:var(--color-rose-clair)] p-4 sm:p-6">
      <div className="rounded-[var(--radius-carte)] border border-[color:var(--color-bordure)] bg-[color:var(--color-surface)] p-5 sm:p-7">
        <p className="m-0 text-[0.8125rem] font-bold uppercase tracking-[0.1em] text-[color:var(--color-accent)]">Mathématiques · Seconde</p>
        <p className="m-0 mt-2 text-[1.625rem] font-extrabold leading-tight tracking-[-0.03em]">Fonctions affines</p>
        <p className="m-0 mt-3 border-b border-[color:var(--color-bordure)] pb-3 text-[0.9375rem] font-semibold">
          Cours <span className="font-medium text-[color:var(--color-encre-faible)]">· Exercices · Documents</span>
        </p>
        <div className="mt-4 grid items-center gap-4 sm:grid-cols-[1fr_auto]">
          <div>
            <p className="m-0 text-[1.0625rem] font-bold">Reconnaître une fonction affine</p>
            <p className="m-0 mt-2 text-[1rem]">
              Elle s&apos;écrit <strong>f(x) = ax + b</strong>, où <em>a</em> est le coefficient directeur et <em>b</em> l&apos;ordonnée à l&apos;origine.
            </p>
            <p className="m-0 mt-3 rounded-[12px] bg-[color:var(--color-fond)] px-4 py-3 text-[0.9375rem]">
              Exemple : f(x) = 2x + 1. Pour x = 3, f(3) = 2 × 3 + 1 = 7.
            </p>
          </div>
          <GraphiqueAffine />
        </div>
        <p className="m-0 mt-4 flex items-center gap-2 border-t border-[color:var(--color-bordure)] pt-3 text-[0.9375rem]">
          <span className="font-bold">À faire</span>
          <span className="text-[color:var(--color-encre-faible)]">· Exercices 1 à 3 · pour jeudi</span>
        </p>
      </div>
      <figcaption className="mt-3 text-[0.8125rem] font-semibold text-[color:var(--color-encre-faible)]">Exemple de présentation</figcaption>
    </figure>
  );
}

const MATIERES = [
  {
    cle: "maths",
    nom: "Mathématiques",
    cours: "Fonctions affines",
    ressources: ["Fiche de cours · PDF", "Exercices 1 à 3"],
    echeance: "À rendre jeudi",
  },
  {
    cle: "histoire",
    nom: "Histoire",
    cours: "La Révolution française",
    ressources: ["Frise chronologique", "Document : la Déclaration de 1789"],
    echeance: "Lecture pour lundi",
  },
  {
    cle: "anglais",
    nom: "Anglais",
    cours: "Unit 4 · Describing a city",
    ressources: ["Vocabulaire de l'unité", "Audio : interview"],
    echeance: "Oral jeudi prochain",
  },
] as const;

/**
 * L03 — sélecteur de matière de démonstration. Boutons radio natifs : il
 * fonctionne sans script, au clavier (flèches), et chaque panneau suit sa
 * matière par CSS. Les lignes d'exemple ne sont pas interactives.
 */
export function ExempleMatieres() {
  return (
    <div className="exemple-matieres rounded-[var(--radius-carte)] border border-[color:var(--color-bordure)] bg-[color:var(--color-surface)] p-5 sm:p-7">
      <fieldset className="m-0 border-0 p-0">
        <legend className="mb-3 text-[0.875rem] font-bold">Choisis une matière (exemple)</legend>
        <div className="flex flex-wrap gap-2">
          {MATIERES.map((m, i) => (
            <label key={m.cle} className="exemple-matiere">
              <input type="radio" name="exemple-matiere" value={m.cle} defaultChecked={i === 0} className="sr-only" />
              <span>{m.nom}</span>
            </label>
          ))}
        </div>
      </fieldset>
      {MATIERES.map((m) => (
        <div key={m.cle} className="exemple-panneau mt-5" data-matiere={m.cle}>
          <p className="m-0 text-[0.8125rem] font-bold uppercase tracking-[0.1em] text-[color:var(--color-accent)]">{m.nom}</p>
          <p className="m-0 mt-1 text-[1.25rem] font-extrabold tracking-[-0.02em]">{m.cours}</p>
          <ul className="m-0 mt-3 list-none p-0">
            {m.ressources.map((r) => (
              <li key={r} className="flex min-h-12 items-center gap-3 border-b border-[color:var(--color-bordure)] text-[1rem]">
                <FileText size={18} strokeWidth={1.75} aria-hidden="true" className="shrink-0 text-[color:var(--color-encre-faible)]" />
                {r}
              </li>
            ))}
            <li className="flex min-h-12 items-center gap-3 text-[1rem] font-semibold">
              <CheckCircle2 size={18} strokeWidth={1.75} aria-hidden="true" className="shrink-0 text-[color:var(--color-accent)]" />
              {m.echeance}
            </li>
          </ul>
        </div>
      ))}
      <p className="m-0 mt-4 text-[0.8125rem] font-semibold text-[color:var(--color-encre-faible)]">Exemple illustratif</p>
    </div>
  );
}

/** L04 — trois messages d'un salon collectif, sans champ de saisie. */
export function ExempleEchange() {
  const messages = [
    { qui: "Lina", role: "Élève", texte: "Pourquoi remplace-t-on x par 3 dans l'exemple du cours ?" },
    { qui: "Mme Bernard", role: "Professeure", texte: "On cherche l'image de 3 : on calcule f(3) = 2 × 3 + 1 = 7." },
    { qui: "Samir", role: "Élève", texte: "Merci, c'est plus clair avec le graphique de la fiche." },
  ];
  return (
    <figure className="m-0 grid gap-3">
      <p className="m-0 flex items-center gap-2 text-[0.875rem] font-bold text-[color:var(--color-encre)]">
        <Users size={18} strokeWidth={1.75} aria-hidden="true" className="text-[color:var(--color-accent)]" />
        Salon de la classe · Seconde 1
      </p>
      <ol className="m-0 grid list-none gap-3 p-0">
        {messages.map((m) => (
          <li key={m.texte} className="rounded-[var(--radius-carte)] border border-[color:var(--color-bordure)] bg-[color:var(--color-surface)] p-4 sm:p-5">
            <p className="m-0 text-[0.9375rem]">
              <strong>{m.qui}</strong> <span className="text-[color:var(--color-encre-faible)]">· {m.role}</span>
            </p>
            <p className="m-0 mt-1 text-[1rem]">{m.texte}</p>
          </li>
        ))}
      </ol>
      <figcaption className="text-[0.8125rem] font-semibold text-[color:var(--color-encre-faible)]">
        Échange illustratif · salon collectif de classe · source : cours « Fonctions affines »
      </figcaption>
    </figure>
  );
}

/** L05 — préparer, choisir la classe, publier : trois états d'une même séance. */
export function ExemplePublication() {
  const etapes = [
    { etat: "Brouillon", detail: "Séance « Fonctions affines » · 3 sections, 1 document", ton: "neutre" },
    { etat: "Classe choisie", detail: "Seconde 1 · vérifiée avant publication", ton: "neutre" },
    { etat: "Publié", detail: "Visible dans l'espace des élèves de Seconde 1", ton: "baie" },
  ] as const;
  return (
    <figure className="m-0 rounded-[var(--radius-grand)] bg-[color:var(--color-surface)] p-5 ring-1 ring-[color:var(--color-bordure)] sm:p-7">
      <ol className="m-0 grid list-none gap-3 p-0">
        {etapes.map((e, i) => (
          <li key={e.etat} className="flex items-start gap-4 rounded-[var(--radius-carte)] border border-[color:var(--color-bordure)] p-4">
            <span
              className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-[0.9375rem] font-extrabold ${e.ton === "baie" ? "bg-[color:var(--color-accent)] text-white" : "bg-[color:var(--color-rose-clair)] text-[color:var(--color-accent)]"}`}
              aria-hidden="true"
            >
              {i + 1}
            </span>
            <span>
              <span className="block text-[1rem] font-bold">{e.etat}</span>
              <span className="block text-[0.9375rem] text-[color:var(--color-encre-faible)]">{e.detail}</span>
            </span>
          </li>
        ))}
      </ol>
      <figcaption className="mt-3 text-[0.8125rem] font-semibold text-[color:var(--color-encre-faible)]">Exemple illustratif d&apos;une publication</figcaption>
    </figure>
  );
}
