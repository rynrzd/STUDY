"use client";

import { useActionState, useId, useState } from "react";
import { useFormStatus } from "react-dom";
import { signalerUnContenu } from "@/app/eleve/actions";
import { ETAT_ELEVE_INITIAL, type EtatEleve } from "@/app/eleve/etats";

/**
 * Signaler un message d'entraide — cahier V5, §7.
 *
 * **Le bouton est discret, et c'est voulu.** Un « Signaler » aussi visible que
 * « Répondre » transforme une classe en salle de délation. Il est là, il se
 * trouve quand on le cherche, et il ne se propose pas.
 *
 * **Ce que l'écran promet, et rien de plus.** « Un responsable le regardera. »
 * Pas « le message sera supprimé », pas « l'auteur sera sanctionné » : un
 * signalement seul ne décide de rien, et laisser croire le contraire ferait
 * deux déçus — celui qui signale pour rien, et celui qui est masqué sans que
 * personne ait tranché.
 *
 * **L'auteur ne sait jamais qui l'a signalé.** Rien ici ne l'affiche, et la
 * politique `reports_auteur_lecture` fait qu'il ne peut pas non plus le lire
 * en interrogeant la base.
 */

const RAISONS = [
  { valeur: "harcelement", libelle: "Cela s'en prend à quelqu'un" },
  { valeur: "contenu_inapproprie", libelle: "Le contenu est déplacé" },
  { valeur: "hors_sujet", libelle: "Ce n'est pas lié au cours" },
  { valeur: "autre", libelle: "Autre raison" },
] as const;

export function Signaler({
  genre,
  cible,
  seance,
  dejaSignale,
}: {
  genre: "fil" | "reponse";
  cible: string;
  seance: string;
  dejaSignale: boolean;
}) {
  const [ouvert, setOuvert] = useState(false);
  const [etat, envoyer] = useActionState<EtatEleve, FormData>(
    signalerUnContenu,
    ETAT_ELEVE_INITIAL,
  );
  const champRaison = useId();
  const champDetail = useId();

  // Une fois signalé, le bouton disparaît : le redonner inviterait à
  // recommencer, et la base refuserait — ce qui donnerait une erreur là où il
  // n'y a pas de faute.
  if (dejaSignale || etat.etat === "ok") {
    return (
      <p
        role="status"
        data-testid="signalement-fait"
        className="m-0 mt-2 text-[length:var(--text-aide)] text-[color:var(--color-encre-faible)]"
      >
        {etat.etat === "ok" && etat.message !== undefined
          ? etat.message
          : "Vous avez signalé ce message."}
      </p>
    );
  }

  if (!ouvert) {
    return (
      <button
        type="button"
        data-testid={`signaler-${genre}`}
        data-cible={cible}
        onClick={() => setOuvert(true)}
        className="mt-2 border-0 bg-transparent p-0 text-left text-[length:var(--text-aide)] text-[color:var(--color-encre-faible)] underline decoration-dotted underline-offset-2 hover:text-[color:var(--color-encre)]"
      >
        Signaler ce message
      </button>
    );
  }

  return (
    <form
      action={envoyer}
      data-testid="signalement-formulaire"
      className="mt-3 rounded-[var(--radius-carte)] border border-[color:var(--color-bordure)] bg-[color:var(--color-surface-douce)] p-4"
    >
      <input type="hidden" name="genre" value={genre} />
      <input type="hidden" name="cible" value={cible} />
      <input type="hidden" name="seance" value={seance} />

      <label htmlFor={champRaison} className="etiquette">
        Pourquoi signalez-vous ce message ?
      </label>
      <select
        id={champRaison}
        name="raison"
        required
        defaultValue=""
        data-testid="signalement-raison"
        className="champ mt-1"
      >
        <option value="" disabled>
          Choisir une raison
        </option>
        {RAISONS.map((raison) => (
          <option key={raison.valeur} value={raison.valeur}>
            {raison.libelle}
          </option>
        ))}
      </select>

      <label htmlFor={champDetail} className="etiquette mt-4 block">
        Vous pouvez préciser (facultatif)
      </label>
      <textarea
        id={champDetail}
        name="detail"
        rows={2}
        maxLength={1000}
        data-testid="signalement-detail"
        className="champ mt-1"
      />

      <span className="aide-champ">
        Un responsable de l&apos;établissement le regardera. Votre nom ne sera pas
        montré à l&apos;auteur du message.
      </span>

      {etat.etat === "erreur" ? (
        <p
          role="alert"
          data-testid="signalement-erreur"
          className="m-0 mt-3 text-[length:var(--text-aide)] text-[color:var(--color-erreur)]"
        >
          {etat.message}
        </p>
      ) : null}

      <div className="mt-4 flex flex-wrap gap-3">
        <BoutonEnvoi />
        <button
          type="button"
          onClick={() => setOuvert(false)}
          className="bouton bouton-secondaire bouton-compact"
        >
          Annuler
        </button>
      </div>
    </form>
  );
}

function BoutonEnvoi() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      data-testid="signalement-envoyer"
      disabled={pending}
      className="bouton bouton-secondaire bouton-compact"
    >
      {pending ? "Envoi…" : "Signaler"}
    </button>
  );
}
