"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { changerSonMotDePasse } from "@/app/parametres/actions";
import { ETAT_PARAMETRES_INITIAL, type EtatParametres } from "@/app/parametres/etats";
import { LONGUEUR_MINIMALE } from "@/lib/mot-de-passe";

/**
 * Changement de mot de passe — cahier V2, §15.
 *
 * Trois champs, dont l'actuel. La règle de longueur est écrite avant la saisie,
 * pas après le refus : personne n'aime apprendre la contrainte en la violant.
 */
export function MotDePasse() {
  const [etat, action] = useActionState<EtatParametres, FormData>(
    changerSonMotDePasse,
    ETAT_PARAMETRES_INITIAL,
  );

  return (
    <form action={action} className="bloc border border-[color:var(--color-bordure)] p-5">
      <h2 className="m-0 text-[length:var(--text-h2-app)] leading-[var(--text-h2-app--line-height)]">
        Mot de passe
      </h2>
      <p className="m-0 mt-2 max-w-[var(--spacing-lecture)] text-[length:var(--text-aide)] leading-[var(--text-aide--line-height)] text-[color:var(--color-encre-faible)]">
        Au moins {LONGUEUR_MINIMALE} caractères. Choisissez une phrase dont vous
        vous souviendrez : elle protège mieux qu&apos;un mot court compliqué.
      </p>

      <div className="mt-4 max-w-[26rem]">
        <label className="etiquette" htmlFor="mdp-actuel">
          Mot de passe actuel
        </label>
        <input
          id="mdp-actuel"
          name="actuel"
          type="password"
          className="champ"
          required
          autoComplete="current-password"
        />
      </div>

      <div className="mt-4 max-w-[26rem]">
        <label className="etiquette" htmlFor="mdp-nouveau">
          Nouveau mot de passe
        </label>
        <input
          id="mdp-nouveau"
          name="nouveau"
          type="password"
          className="champ"
          required
          minLength={LONGUEUR_MINIMALE}
          autoComplete="new-password"
        />
      </div>

      <div className="mt-4 max-w-[26rem]">
        <label className="etiquette" htmlFor="mdp-confirmation">
          Confirmation
        </label>
        <input
          id="mdp-confirmation"
          name="confirmation"
          type="password"
          className="champ"
          required
          minLength={LONGUEUR_MINIMALE}
          autoComplete="new-password"
        />
      </div>

      <Bouton />

      {etat.etat === "vierge" || etat.message === undefined ? null : (
        <p
          role="status"
          className={`m-0 mt-3 text-[length:var(--text-tableau)] ${
            etat.etat === "ok"
              ? "text-[color:var(--color-succes)]"
              : "text-[color:var(--color-erreur)]"
          }`}
        >
          {etat.message}
        </p>
      )}
    </form>
  );
}

function Bouton() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="bouton bouton-rose mt-5">
      {pending ? "…" : "Changer le mot de passe"}
    </button>
  );
}
