"use client";

import { useActionState, useId, useState } from "react";
import { useFormStatus } from "react-dom";
import {
  enregistrerLaCorrectionCommune,
  retirerLaCorrectionCommune,
} from "@/app/professeur/devoirs/actions";
import { ETAT_DEVOIR_INITIAL, type EtatDevoirAction } from "@/app/professeur/devoirs/etats";
import { instantLisible } from "@/lib/horodatage";

/**
 * La correction adressée à toute la classe — cahier V5, §5.2.
 *
 * **Pourquoi elle existe.** Un professeur qui corrige trente copies écrit trente
 * fois la même remarque sur la question 3, ou ne l'écrit nulle part. Celle-ci se
 * rédige une fois, et s'adresse à ceux qui ont reçu le devoir.
 *
 * **Elle ne remplace pas le retour individuel.** Les deux coexistent et se
 * publient séparément : « voici ce qu'il fallait faire » n'est pas « voici ce
 * que vous, vous avez fait ». Publier l'une ne publie pas l'autre, et l'écran
 * ne propose aucun raccourci qui les confondrait.
 *
 * **Le brouillon protège le droit de se raviser.** Tant qu'elle n'est pas
 * publiée, aucun élève ne sait qu'elle existe.
 */
export function CorrectionCommune({
  devoir,
  organisation,
  correction,
  nombreEleves,
}: {
  devoir: string;
  organisation: string;
  correction: {
    readonly id: string;
    readonly texte: string;
    readonly fichier: string | null;
    readonly publieeLe: string | null;
  } | null;
  nombreEleves: number;
}) {
  const [etat, enregistrer] = useActionState<EtatDevoirAction, FormData>(
    enregistrerLaCorrectionCommune,
    ETAT_DEVOIR_INITIAL,
  );
  const [etatRetrait, retirer] = useActionState<EtatDevoirAction, FormData>(
    retirerLaCorrectionCommune,
    ETAT_DEVOIR_INITIAL,
  );

  const champTexte = useId();
  const champFichier = useId();
  const [texte, setTexte] = useState(correction?.texte ?? "");

  const publiee = correction !== null && correction.publieeLe !== null;
  const dernier = etatRetrait.etat === "vierge" ? etat : etatRetrait;

  return (
    <section aria-labelledby="titre-correction-commune" className="mt-12 print:hidden">
      <div className="flex flex-wrap items-baseline justify-between gap-3">
        <h2
          id="titre-correction-commune"
          className="m-0 text-[length:var(--text-h2-app)] leading-[var(--text-h2-app--line-height)]"
        >
          Correction pour toute la classe
        </h2>

        <p
          data-testid="correction-commune-etat"
          data-publiee={publiee ? "oui" : "non"}
          className="m-0 text-[length:var(--text-aide)] text-[color:var(--color-encre-faible)]"
        >
          {correction === null
            ? "Aucune correction commune"
            : publiee
              ? `Publiée le ${instantLisible(correction.publieeLe!)}`
              : "Brouillon — personne ne la voit"}
        </p>
      </div>

      <p className="m-0 mt-2 max-w-[var(--spacing-lecture)] text-[length:var(--text-aide)] text-[color:var(--color-encre-faible)]">
        Ce que vous écrivez ici est lu par les {nombreEleves} élèves à qui ce devoir a
        été donné, une fois publié. Pour parler à un seul élève de sa copie,
        utilisez la correction de sa ligne, plus haut.
      </p>

      <form action={enregistrer} className="mt-5 max-w-[var(--spacing-lecture)]">
        <input type="hidden" name="devoir" value={devoir} />
        <input type="hidden" name="organisation" value={organisation} />

        <label htmlFor={champTexte} className="label">
          Ce qu&apos;il fallait faire
        </label>
        <textarea
          id={champTexte}
          name="texte"
          rows={7}
          maxLength={10000}
          value={texte}
          onChange={(evenement) => setTexte(evenement.target.value)}
          data-testid="correction-commune-texte"
          className="champ mt-1 w-full"
          placeholder="La question 3 attendait le théorème de Thalès. Beaucoup ont appliqué Pythagore : les deux triangles ne sont pas rectangles."
        />

        <label htmlFor={champFichier} className="label mt-5 block">
          Le corrigé, si vous en avez un (facultatif)
        </label>
        <input
          id={champFichier}
          type="file"
          name="corrige"
          accept=".pdf,.doc,.docx,.odt,.png,.jpg,.jpeg"
          data-testid="correction-commune-fichier"
          className="champ mt-1 w-full"
        />
        {correction?.fichier != null ? (
          <p className="m-0 mt-2 text-[length:var(--text-aide)] text-[color:var(--color-encre-faible)]">
            Un corrigé est déjà joint. En déposer un autre le remplacera ; ne rien
            déposer le laisse en place.
          </p>
        ) : null}

        <div className="mt-6 flex flex-wrap gap-3">
          <BoutonEnvoi
            nom="publier"
            valeur="non"
            libelle="Enregistrer en brouillon"
            marque="correction-commune-brouillon"
            secondaire
          />
          <BoutonEnvoi
            nom="publier"
            valeur="oui"
            libelle={publiee ? "Enregistrer et republier" : "Publier à la classe"}
            marque="correction-commune-publier"
          />
        </div>
      </form>

      {publiee ? (
        <form action={retirer} className="mt-4">
          <input type="hidden" name="devoir" value={devoir} />
          <input type="hidden" name="correction" value={correction.id} />
          <BoutonEnvoi
            libelle="Retirer de la vue des élèves"
            marque="correction-commune-retirer"
            discret
          />
        </form>
      ) : null}

      {/* Le message est annoncé, pas seulement affiché : le professeur qui
          publie a souvent le regard sur la liste des élèves, pas sur le
          bouton. */}
      <p
        role="status"
        aria-live="polite"
        data-testid="correction-commune-message"
        className={`m-0 mt-4 text-[length:var(--text-aide)] ${
          dernier.etat === "erreur"
            ? "text-[color:var(--color-erreur)]"
            : "text-[color:var(--color-encre-faible)]"
        }`}
      >
        {dernier.etat === "vierge" ? "" : dernier.message}
      </p>
    </section>
  );
}

function BoutonEnvoi({
  libelle,
  marque,
  nom,
  valeur,
  secondaire = false,
  discret = false,
}: {
  libelle: string;
  marque: string;
  nom?: string;
  valeur?: string;
  secondaire?: boolean;
  discret?: boolean;
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      name={nom}
      value={valeur}
      data-testid={marque}
      disabled={pending}
      className={`bouton ${discret ? "bouton-discret bouton-compact" : secondaire ? "bouton-secondaire" : "bouton-primaire"}`}
    >
      {pending ? "…" : libelle}
    </button>
  );
}
