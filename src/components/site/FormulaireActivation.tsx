"use client";

import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import { activerCompte } from "@/app/activation/actions";
import { ETAT_INITIAL, type EtatActivation } from "@/app/activation/etats";
import { LONGUEUR_MINIMALE } from "@/lib/mot-de-passe";

/** Choix du mot de passe personnel, à la première connexion. */
export function FormulaireActivation() {
  const [etat, action] = useActionState<EtatActivation, FormData>(activerCompte, ETAT_INITIAL);
  const alerte = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (etat.etat === "erreur") alerte.current?.focus();
  }, [etat]);

  return (
    <form action={action} className="mt-8" noValidate>
      {etat.etat === "erreur" ? (
        <div
          ref={alerte}
          tabIndex={-1}
          role="alert"
          className="mb-6 rounded-[var(--radius-carte)] border border-[color:var(--color-erreur)] bg-[color:var(--color-erreur-fond)] p-4"
        >
          <p className="m-0 font-semibold text-[color:var(--color-erreur)]">{etat.message}</p>
        </div>
      ) : null}

      <div className="space-y-6">
        <div>
          <label className="etiquette" htmlFor="nouveau">
            Nouveau mot de passe
          </label>
          <input
            className="champ"
            id="nouveau"
            name="nouveau"
            type="password"
            autoComplete="new-password"
            minLength={LONGUEUR_MINIMALE}
            aria-describedby="aide-nouveau"
            required
          />
          <span className="aide-champ" id="aide-nouveau">
            Au moins {LONGUEUR_MINIMALE} caractères. Une phrase courte que vous
            retenez vaut mieux qu&apos;un mot compliqué que vous noterez quelque
            part.
          </span>
        </div>

        <div>
          <label className="etiquette" htmlFor="confirmation">
            Confirmer le mot de passe
          </label>
          <input
            className="champ"
            id="confirmation"
            name="confirmation"
            type="password"
            autoComplete="new-password"
            minLength={LONGUEUR_MINIMALE}
            required
          />
        </div>
      </div>

      <BoutonActivation />
    </form>
  );
}

function BoutonActivation() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      data-testid="activation-valider"
      disabled={pending}
      className="bouton bouton-primaire mt-8 w-full"
    >
      {pending ? "Enregistrement…" : "Enregistrer et continuer"}
    </button>
  );
}
