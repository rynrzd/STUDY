"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { lireUneNouveaute, toutLire } from "@/app/eleve/actions";
import { ETAT_ELEVE_INITIAL, type EtatEleve } from "@/app/eleve/etats";
import type { GenreNouveaute, Nouveaute } from "@/lib/nouveautes";

// Les libellés vivent ici, et non dans `@/lib/nouveautes` : ce module est
// `server-only`, et un composant client qui en importe une **valeur** fait
// entrer la clé privilégiée dans le bundle. Seuls les types traversent, parce
// qu ils sont effacés à la compilation.
const LIBELLE: Readonly<Record<GenreNouveaute, string>> = {
  devoir_publie: "Nouveau devoir",
  echeance_proche: "À rendre bientôt",
  correction_publiee: "Correction de la classe",
  retour_individuel: "Retour sur votre copie",
  devoir_modifie: "Devoir modifié",
};

/**
 * Ce qui concerne cet élève — cahier V5, §9.
 *
 * **Pas de courriel, pas de notification poussée.** Une liste, dans
 * l'application, quand on l'ouvre. Un élève n'a pas à recevoir un message le
 * soir pour un devoir dont l'échéance est dans huit jours.
 *
 * **Une nouveauté lue ne revient pas.** Ouvrir le devoir la marque lue : on ne
 * demande pas à quelqu'un de ranger ce qu'il vient de lire. Le bouton « tout
 * marquer comme lu » existe pour la rentrée, quand la liste s'est accumulée
 * pendant les vacances.
 *
 * **Rien de tout cela ne remplace la liste des devoirs.** Ce bloc dit ce qui
 * vient d'arriver ; « À faire » dit ce qu'il reste à faire. Confondre les deux
 * ferait disparaître un devoir non rendu le jour où l'élève a lu sa ligne.
 */
export function Nouveautes({ nouveautes }: { nouveautes: readonly Nouveaute[] }) {
  const [, tout] = useActionState<EtatEleve, FormData>(toutLire, ETAT_ELEVE_INITIAL);

  const nonLues = nouveautes.filter((ligne) => !ligne.lue);
  if (nouveautes.length === 0) return null;

  return (
    <section aria-labelledby="titre-nouveautes" className="mt-11 print:hidden">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2
          id="titre-nouveautes"
          className="m-0 text-[length:var(--text-h2-app)] leading-[var(--text-h2-app--line-height)]"
        >
          Ce qui vous concerne
          {nonLues.length > 0 ? (
            <span
              data-testid="nouveautes-non-lues"
              data-compte={nonLues.length}
              className="ml-2 rounded-full bg-[color:var(--color-accent)] px-2 py-0.5 align-middle text-[0.7rem] font-semibold text-[color:var(--color-sur-accent)]"
            >
              {nonLues.length}
            </span>
          ) : null}
        </h2>

        {nonLues.length > 0 ? (
          <form action={tout}>
            <BoutonDiscret libelle="Tout marquer comme lu" marque="nouveautes-tout-lire" />
          </form>
        ) : null}
      </div>

      <ul data-testid="nouveautes" className="m-0 mt-4 list-none p-0">
        {nouveautes.map((nouveaute) => (
          <li key={nouveaute.id}>
            <Ligne nouveaute={nouveaute} />
          </li>
        ))}
      </ul>
    </section>
  );
}

function Ligne({ nouveaute }: { nouveaute: Nouveaute }) {
  const [, marquer] = useActionState<EtatEleve, FormData>(lireUneNouveaute, ETAT_ELEVE_INITIAL);

  return (
    <form
      action={marquer}
      data-testid="nouveaute"
      data-genre={nouveaute.genre}
      data-lue={nouveaute.lue ? "oui" : "non"}
    >
      <input type="hidden" name="nouveaute" value={nouveaute.id} />
      <input type="hidden" name="devoir" value={nouveaute.devoir} />

      {/* Un bouton, pas un lien : ouvrir marque lu, et les deux doivent être
          le même geste. Un lien qui déclenche une écriture en passant est ce
          qui fait qu'un aperçu de navigateur marque les choses lues tout seul. */}
      <button
        type="submit"
        className={`flex w-full min-h-[var(--spacing-cible)] flex-wrap items-center justify-between gap-3 border-0 border-b border-[color:var(--color-bordure)] bg-transparent px-1 py-3 text-left transition-colors hover:bg-[color:var(--color-survol)] ${
          nouveaute.lue ? "opacity-60" : ""
        }`}
      >
        <span className="min-w-0">
          <span className="block truncate font-medium text-[color:var(--color-encre)]">
            {nouveaute.titre}
          </span>
          <span className="mt-0.5 block text-[length:var(--text-aide)] text-[color:var(--color-encre-faible)]">
            {LIBELLE[nouveaute.genre]}
            {nouveaute.genre === "echeance_proche" && nouveaute.echeance !== null
              ? ` · ${quandLisible(nouveaute.echeance)}`
              : ""}
          </span>
        </span>
        {!nouveaute.lue ? (
          <span
            aria-hidden="true"
            className="size-2 shrink-0 rounded-full bg-[color:var(--color-accent)]"
          />
        ) : null}
        <span className="sr-only">{nouveaute.lue ? "" : "Non lu."} Ouvrir le devoir.</span>
      </button>
    </form>
  );
}

/**
 * « demain à 08:00 » plutôt qu'une date complète.
 *
 * Une échéance proche se lit en relatif : c'est la question que l'élève se
 * pose, et « le 14 » oblige à vérifier quel jour on est.
 */
function quandLisible(instant: string): string {
  const echeance = new Date(instant);
  if (Number.isNaN(echeance.getTime())) return "";

  const heure = new Intl.DateTimeFormat("fr-FR", {
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Europe/Paris",
  }).format(echeance);

  const jourDe = (date: Date) =>
    new Intl.DateTimeFormat("fr-CA", { timeZone: "Europe/Paris" }).format(date);

  const maintenant = new Date();
  const demain = new Date(maintenant.getTime() + 24 * 60 * 60 * 1000);

  if (jourDe(echeance) === jourDe(maintenant)) return `aujourd'hui à ${heure}`;
  if (jourDe(echeance) === jourDe(demain)) return `demain à ${heure}`;

  return new Intl.DateTimeFormat("fr-FR", {
    weekday: "long",
    day: "numeric",
    month: "long",
    timeZone: "Europe/Paris",
  }).format(echeance);
}

function BoutonDiscret({ libelle, marque }: { libelle: string; marque: string }) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      data-testid={marque}
      disabled={pending}
      className="bouton bouton-discret bouton-compact"
    >
      {pending ? "…" : libelle}
    </button>
  );
}
