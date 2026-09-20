"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { demanderDeLAide, repondreAUnCamarade } from "@/app/eleve/actions";
import { ETAT_ELEVE_INITIAL, type EtatEleve } from "@/app/eleve/etats";
import type { FilEntraide } from "@/lib/parcours-eleve";

/**
 * « Je n'ai pas compris » — cahier V5, §3.5.
 *
 * L'entraide est accrochée à une séance, et à elle seule. Il n'existe pas de
 * fil général, pas de message privé, pas de réponse automatique présentée
 * comme vraie : ce sont les trois interdits du §3.5, et ils tiennent parce que
 * cet écran ne sait rien faire d'autre.
 *
 * Les questions restent lisibles par toute la classe. C'est volontaire : la
 * question qu'un élève ose poser en sert dix autres qui n'osaient pas.
 */
export function Entraide({
  seance,
  fils,
  moi,
}: {
  seance: string;
  fils: readonly FilEntraide[];
  moi: string;
}) {
  const [ouvert, setOuvert] = useState(false);
  const [etat, poser] = useActionState<EtatEleve, FormData>(demanderDeLAide, ETAT_ELEVE_INITIAL);

  // `print:hidden` : une discussion ne s'imprime pas. Ce qu'on colle dans un
  // cahier, c'est le cours — pas les questions qu'il a suscitées.
  return (
    <section aria-labelledby="titre-entraide" className="mt-12 print:hidden">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2
          id="titre-entraide"
          className="text-[length:var(--text-h2-app)] leading-[var(--text-h2-app--line-height)]"
        >
          Questions sur ce cours
        </h2>
        {!ouvert ? (
          <button
            type="button"
            data-testid="entraide-ouvrir"
            onClick={() => setOuvert(true)}
            className="bouton bouton-secondaire"
          >
            Je n&apos;ai pas compris
          </button>
        ) : null}
      </div>

      {ouvert ? (
        <form action={poser} data-testid="entraide-question" className="carte mt-4 p-5">
          <input type="hidden" name="seance" value={seance} />
          <label className="etiquette" htmlFor="question">
            Qu&apos;est-ce qui coince ?
          </label>
          <textarea
            data-testid="entraide-texte-question"
            id="question"
            name="question"
            rows={3}
            required
            minLength={3}
            maxLength={1000}
            placeholder="Je ne comprends pas comment passer de la ligne 2 à la ligne 3."
            className="champ"
          />
          <span className="aide-champ">
            Votre classe et votre professeur la verront. Personne d&apos;autre.
          </span>

          {etat.etat !== "vierge" ? (
            <p
              role="status"
              className={`m-0 mt-3 text-[length:var(--text-aide)] ${
                etat.etat === "erreur"
                  ? "text-[color:var(--color-erreur)]"
                  : "text-[color:var(--color-succes)]"
              }`}
            >
              {etat.message}
            </p>
          ) : null}

          <div className="mt-4 flex flex-wrap gap-3">
            <Bouton libelle="Poser la question" variante="primaire" marque="entraide-poser" />
            <button
              type="button"
              onClick={() => setOuvert(false)}
              className="bouton bouton-secondaire"
            >
              Annuler
            </button>
          </div>
        </form>
      ) : null}

      {fils.length === 0 ? (
        <p className="m-0 mt-4 max-w-[var(--spacing-lecture)] text-[color:var(--color-encre-faible)]">
          Personne n&apos;a encore posé de question sur ce cours.
        </p>
      ) : (
        <ul className="m-0 mt-5 list-none space-y-4 p-0">
          {fils.map((fil) => (
            <li key={fil.id}>
              <Fil fil={fil} seance={seance} moi={moi} />
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function Fil({ fil, seance, moi }: { fil: FilEntraide; seance: string; moi: string }) {
  const [etat, envoyer] = useActionState<EtatEleve, FormData>(
    repondreAUnCamarade,
    ETAT_ELEVE_INITIAL,
  );

  return (
    <article className="carte p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="m-0 text-[length:var(--text-aide)] text-[color:var(--color-encre-faible)]">
          {fil.auteurId === moi ? "Votre question" : fil.auteur}
        </p>
        {fil.resolu ? (
          <span className="rounded-full bg-[color:var(--color-succes-fond)] px-2.5 py-0.5 text-[0.7rem] font-semibold text-[color:var(--color-succes)]">
            résolue
          </span>
        ) : null}
      </div>

      <p className="m-0 mt-1.5 whitespace-pre-line">{fil.question}</p>

      {fil.reponses.length > 0 ? (
        <ul className="m-0 mt-4 list-none space-y-3 border-t border-[color:var(--color-bordure)] p-0 pt-4">
          {fil.reponses.map((reponse) => (
            <li key={reponse.id}>
              <p className="m-0 flex flex-wrap items-center gap-2 text-[length:var(--text-aide)] text-[color:var(--color-encre-faible)]">
                {reponse.auteur}
                {reponse.utile ? (
                  <span className="rounded-full bg-[color:var(--color-succes-fond)] px-2 py-0.5 text-[0.7rem] font-semibold text-[color:var(--color-succes)]">
                    réponse retenue par le professeur
                  </span>
                ) : null}
              </p>
              <p className="m-0 mt-0.5 whitespace-pre-line">{reponse.texte}</p>
            </li>
          ))}
        </ul>
      ) : null}

      <form action={envoyer} data-testid="entraide-reponse" data-fil={fil.id} className="mt-4">
        <input type="hidden" name="fil" value={fil.id} />
        <input type="hidden" name="seance" value={seance} />
        <label className="sr-only" htmlFor={`reponse-${fil.id}`}>
          Répondre à cette question
        </label>
        <div className="flex flex-wrap items-end gap-3">
          <div className="min-w-0 flex-1">
            <input
              id={`reponse-${fil.id}`}
              data-testid="entraide-texte-reponse"
              name="texte"
              type="text"
              required
              maxLength={2000}
              placeholder="Expliquer, sans donner la réponse toute faite"
              className="champ"
            />
          </div>
          <Bouton libelle="Répondre" variante="secondaire" marque="entraide-repondre" />
        </div>

        {etat.etat === "erreur" ? (
          <p
            role="alert"
            className="m-0 mt-2 text-[length:var(--text-aide)] text-[color:var(--color-erreur)]"
          >
            {etat.message}
          </p>
        ) : null}
      </form>
    </article>
  );
}

function Bouton({
  libelle,
  variante,
  marque,
}: {
  libelle: string;
  variante: "primaire" | "secondaire";
  /** Identifiant stable : deux boutons d envoi coexistent sur un fil. */
  marque?: string;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      data-testid={marque}
      disabled={pending}
      className={`bouton bouton-${variante}`}
    >
      {pending ? "Envoi…" : libelle}
    </button>
  );
}
