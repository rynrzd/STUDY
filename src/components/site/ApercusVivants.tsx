"use client";

import { useId, useRef, useState } from "react";

/**
 * Les aperçus sur lesquels on peut cliquer — L04 et L06.
 *
 * Un visiteur qui voit une capture d'écran se demande si le produit existe. Un
 * visiteur qui clique « Seconde 2 » et voit la classe changer a déjà la
 * réponse. Ces deux aperçus fonctionnent donc pour de bon : les onglets
 * commutent, le contenu suit.
 *
 * Ce qu'ils ne font pas, et ne doivent pas faire : prétendre être connectés.
 * Aucune donnée réelle, aucun compte, aucun bouton qui échoue en silence. Les
 * actions non implémentées — « Publier le cours », « Modifier » — restent des
 * étiquettes, pas des boutons cliquables qui ne feraient rien.
 */

function Cadre({ children }: { children: React.ReactNode }) {
  return (
    <div className="apercu-releve w-full max-w-full min-w-0 overflow-hidden rounded-[var(--radius-carte)] border border-[color:var(--color-bordure)] bg-[color:var(--color-surface)] shadow-[var(--shadow-flottant)]">
      {children}
    </div>
  );
}

function Laterale({ actif, entrees, nom, role }: {
  actif: string;
  entrees: readonly string[];
  nom: string;
  role: string;
}) {
  return (
    <div className="hidden shrink-0 flex-col justify-between border-r border-[color:var(--color-bordure)] sm:flex sm:w-[132px] sm:p-3">
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
      <div className="flex items-center gap-1.5 px-0.5 pt-3 sm:px-1">
        <span className="flex h-4 w-4 shrink-0 items-center justify-center rounded-full bg-[color:var(--color-rose-clair)] text-[0.4375rem] font-bold text-[color:var(--color-accent)] sm:h-5 sm:w-5 sm:text-[0.5rem]">
          {nom.split(" ").map((mot) => mot[0]).join("").slice(0, 2)}
        </span>
        <span className="min-w-0">
          <span className="block truncate text-[0.5rem] font-semibold sm:text-[0.625rem]">{nom}</span>
          <span className="hidden truncate text-[0.5rem] text-[color:var(--color-encre-tres-faible)] sm:block">
            {role}
          </span>
        </span>
      </div>
    </div>
  );
}

/**
 * Une clé d'identifiant stable à partir d'un intitulé.
 *
 * « Ma copie » et « Seconde 1 » contiennent une espace, et un accent peut
 * traîner : ni l'un ni l'autre n'a sa place dans un `id` qu'on va relire avec
 * `getElementById`.
 */
function cle(valeur: string): string {
  return valeur
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

/**
 * Une rangée d'onglets, dans le style de l'aperçu — petit, mais réel.
 *
 * « Réel » veut dire le motif ARIA complet, pas seulement `role="tab"` : un
 * `aria-controls` qui désigne un panneau existant, un seul onglet dans l'ordre
 * de tabulation, et les flèches pour passer de l'un à l'autre.
 *
 * Ce qui manquait ici se voyait à l'usage : ces onglets n'étaient atteignables
 * qu'à la souris, et rien ne reliait un onglet à ce qu'il montrait.
 */
function Onglets({
  base,
  choix,
  actif,
  surChoix,
  etiquette,
}: {
  base: string;
  choix: readonly string[];
  actif: string;
  surChoix: (valeur: string) => void;
  etiquette: string;
}) {
  const boutons = useRef<(HTMLButtonElement | null)[]>([]);

  function auClavier(evenement: React.KeyboardEvent, index: number) {
    const pas = evenement.key === "ArrowRight" ? 1 : evenement.key === "ArrowLeft" ? -1 : 0;
    if (pas === 0) return;
    evenement.preventDefault();

    const suivant = (index + pas + choix.length) % choix.length;
    surChoix(choix[suivant]!);
    boutons.current[suivant]?.focus();
  }

  return (
    <div
      role="tablist"
      aria-label={etiquette}
      className="flex gap-4 border-b border-[color:var(--color-bordure)]"
    >
      {choix.map((entree, index) => {
        const selectionne = entree === actif;
        return (
          <button
            key={entree}
            ref={(element) => {
              boutons.current[index] = element;
            }}
            type="button"
            role="tab"
            id={`${base}-onglet-${cle(entree)}`}
            aria-selected={selectionne}
            aria-controls={`${base}-panneau-${cle(entree)}`}
            tabIndex={selectionne ? 0 : -1}
            onClick={() => surChoix(entree)}
            onKeyDown={(evenement) => auClavier(evenement, index)}
            className={`-mb-px min-h-[var(--spacing-cible)] shrink-0 whitespace-nowrap border-b-2 pb-1.5 text-[0.75rem] transition-colors duration-[160ms] ${
              selectionne
                ? "border-[color:var(--color-accent)] font-semibold text-[color:var(--color-accent)]"
                : "border-transparent text-[color:var(--color-encre-faible)] hover:text-[color:var(--color-encre)]"
            }`}
          >
            {entree}
          </button>
        );
      })}
    </div>
  );
}

/**
 * Le panneau d'un onglet.
 *
 * Tous les panneaux sont rendus, et les inactifs portent `hidden`. C'est ce
 * qui permet à `aria-controls` de désigner un élément qui existe vraiment, et
 * c'est aussi ce qui rend l'aperçu lisible sans JavaScript.
 */
function Panneau({
  base,
  nom,
  actif,
  children,
}: {
  base: string;
  nom: string;
  actif: string;
  children: React.ReactNode;
}) {
  return (
    <div
      role="tabpanel"
      id={`${base}-panneau-${cle(nom)}`}
      aria-labelledby={`${base}-onglet-${cle(nom)}`}
      hidden={nom !== actif}
    >
      {children}
    </div>
  );
}

/* -------------------------------------------------------------------------- */
/* L04 — le côté professeur, avec ses deux classes                            */
/* -------------------------------------------------------------------------- */

const CLASSES = {
  "Seconde 1": {
    chapitre: "Chapitre 3",
    titre: "Fonctions affines",
    etat: "Enregistré comme brouillon",
    points: [
      "Définition et exemples",
      "Représentation graphique",
      "Coefficient directeur",
      "Applications",
    ],
  },
  "Seconde 2": {
    chapitre: "Chapitre 2",
    titre: "Statistiques",
    etat: "Publié mardi",
    points: ["Moyenne et médiane", "Étendue", "Diagrammes", "Exercices 5 à 9"],
  },
} as const;

export function ApercuProfesseur() {
  const [classe, setClasse] = useState<keyof typeof CLASSES>("Seconde 1");
  const base = useId();

  return (
    <Cadre>
      <div className="flex">
        <Laterale
          actif="Cours"
          entrees={["Accueil", "Cours", "Devoirs", "Élèves"]}
          nom="Mme Bernard"
          role="Mathématiques"
        />

        <div className="min-w-0 flex-1 p-3 sm:p-4">
          <Onglets
            base={base}
            choix={Object.keys(CLASSES)}
            actif={classe}
            surChoix={(valeur) => setClasse(valeur as keyof typeof CLASSES)}
            etiquette="Mes classes"
          />

          {/* Sur téléphone, la barre latérale n'est pas là : l'identité du
              professeur remonte ici, sur une ligne, plutôt que de disparaître. */}
          <p className="m-0 mt-3 flex items-center gap-2 text-[0.6875rem] text-[color:var(--color-encre-faible)] sm:hidden">
            <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-[color:var(--color-rose-clair)] text-[0.5rem] font-bold text-[color:var(--color-accent)]">
              MB
            </span>
            Mme Bernard · Mathématiques
          </p>

          {/* Les deux classes sont rendues, l'inactive est masquée. Deux
              chapitres, deux progressions, deux états de publication : le
              cahier demande que les données changent réellement, pas seulement
              la couleur de l'onglet. */}
          {(Object.keys(CLASSES) as (keyof typeof CLASSES)[]).map((nom) => {
            const cours = CLASSES[nom];
            return (
              <Panneau key={nom} base={base} nom={nom} actif={classe}>
                <div className="mt-3 flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="m-0 text-[0.5625rem] uppercase tracking-[0.08em] text-[color:var(--color-encre-tres-faible)]">
                      {cours.chapitre}
                    </p>
                    <p className="m-0 mt-0.5 text-[0.9375rem] font-bold leading-snug sm:truncate sm:text-[0.875rem]">
                      {cours.titre}
                    </p>
                  </div>
                  <span className="shrink-0 rounded-md border border-[color:var(--color-bordure)] px-2 py-1 text-[0.625rem]">
                    Modifier
                  </span>
                </div>

                <ol className="m-0 mt-3 list-none p-0">
                  {cours.points.map((point, rang) => (
                    <li
                      key={point}
                      className="flex items-center justify-between gap-2 border-b border-[color:var(--color-bordure)] py-1.5 text-[0.75rem]"
                    >
                      <span className="min-w-0 sm:truncate">
                        <span className="mr-2 text-[color:var(--color-encre-tres-faible)]">
                          {rang + 1}.
                        </span>
                        {point}
                      </span>
                      <span className="text-[color:var(--color-encre-tres-faible)]">›</span>
                    </li>
                  ))}
                </ol>

                <div className="mt-4 flex flex-wrap items-center gap-3">
                  <span className="inline-flex items-center rounded-md bg-[color:var(--color-encre)] px-3 py-2 text-[0.6875rem] font-semibold text-white">
                    Publier le cours
                  </span>
                  <span className="text-[0.625rem] text-[color:var(--color-encre-tres-faible)]">
                    {cours.etat}
                  </span>
                </div>
              </Panneau>
            );
          })}
        </div>
      </div>
    </Cadre>
  );
}

/* -------------------------------------------------------------------------- */
/* L06 — l'entraide, avec ses trois onglets                                    */
/* -------------------------------------------------------------------------- */

const MESSAGES = [
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
  { auteur: "Lina", heure: "il y a 1 h", texte: "Merci beaucoup ! C'est plus clair maintenant 🙏" },
] as const;

export function ApercuEntraide() {
  const [vue, setVue] = useState("Entraide");
  const base = useId();

  return (
    <Cadre>
      <div className="p-3 sm:p-4">
        <Onglets
          base={base}
          choix={["Devoir", "Ma copie", "Entraide"]}
          actif={vue}
          surChoix={setVue}
          etiquette="Vue du devoir"
        />

        <div className="mt-3">
          <Panneau base={base} nom="Devoir" actif={vue}>
            <div className="rounded-lg bg-[color:var(--color-rose-clair)] p-3">
              <p className="m-0 text-[0.5625rem] uppercase tracking-[0.08em] text-[color:var(--color-accent)]">
                Mathématiques · Exercice 3
              </p>
              <p className="m-0 mt-1 text-[0.8125rem] font-semibold">Fonctions affines</p>
              <p className="m-0 mt-1.5 text-[0.75rem] leading-relaxed">
                Soit la fonction affine <em>f</em> définie par <em>f</em>(x) = 3x − 4.
              </p>
              <ol className="m-0 mt-2 list-decimal space-y-0.5 pl-4 text-[0.6875rem] text-[color:var(--color-encre-faible)]">
                <li>Calculer f(2).</li>
                <li>Déterminer l&apos;antécédent de 5.</li>
              </ol>

              <p className="m-0 mt-2.5 flex items-center gap-1.5 text-[0.625rem] text-[color:var(--color-encre-faible)]">
                <span aria-hidden="true">📎</span> enonce-exercice-3.pdf
              </p>

              <div className="mt-3 flex flex-wrap items-center justify-between gap-2 border-t border-[color:var(--color-rose-decor)] pt-2.5">
                <span className="text-[0.625rem] font-semibold text-[color:var(--color-accent)]">
                  À rendre demain, 18 h
                </span>
                <span className="text-[0.625rem] text-[color:var(--color-encre-faible)]">
                  Non remis
                </span>
              </div>
            </div>
          </Panneau>

          <Panneau base={base} nom="Ma copie" actif={vue}>
            <div className="rounded-lg border border-[color:var(--color-bordure)] p-3">
              <p className="m-0 flex items-center justify-between gap-2 text-[0.5625rem] uppercase tracking-[0.08em] text-[color:var(--color-encre-tres-faible)]">
                Brouillon
                <span className="rounded-full bg-[color:var(--color-succes-fond)] px-2 py-0.5 text-[0.5rem] font-semibold normal-case tracking-normal text-[color:var(--color-succes)]">
                  Remis hier, 17 h 42
                </span>
              </p>

              <p className="m-0 mt-2 flex items-center gap-1.5 text-[0.625rem] text-[color:var(--color-encre-faible)]">
                <span aria-hidden="true">📎</span> exercice-3-camille.pdf
              </p>

              <p className="m-0 mt-2 font-[family-name:var(--font-marque)] text-[0.75rem] italic leading-relaxed">
                <span className="block">1. f(2) = 3 × 2 − 4 = 2</span>
                <span className="mt-1 block text-[color:var(--color-encre-tres-faible)]">2. …</span>
              </p>

              <p className="m-0 mt-3 border-t border-[color:var(--color-bordure)] pt-2.5 text-[0.625rem] text-[color:var(--color-encre-tres-faible)]">
                Remplacement possible jusqu&apos;à l&apos;échéance. La correction
                s&apos;affichera ici une fois publiée.
              </p>
            </div>
          </Panneau>

          <Panneau base={base} nom="Entraide" actif={vue}>
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
                    <span className="mt-0.5 block text-[0.625rem] leading-snug text-[color:var(--color-encre-faible)]">
                      {message.texte}
                    </span>
                    {"calcul" in message ? (
                      <span className="mt-1.5 block rounded border border-[color:var(--color-bordure)] px-2 py-1.5 font-[family-name:var(--font-marque)] text-[0.5625rem] italic leading-relaxed">
                        {message.calcul.map((ligne) => (
                          <span key={ligne} className="block">
                            {ligne}
                          </span>
                        ))}
                      </span>
                    ) : null}
                  </span>
                </li>
              ))}
            </ul>
          </Panneau>
        </div>
      </div>
    </Cadre>
  );
}
