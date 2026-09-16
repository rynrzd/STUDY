"use client";

import { useActionState, useEffect, useId, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { seConnecter } from "@/app/connexion/actions";
import { ETAT_INITIAL, type EtatConnexion } from "@/app/connexion/etats";

/**
 * Formulaire de connexion.
 *
 * Trois champs, et un seul message d'erreur possible : il est identique que le
 * compte existe ou non, qu'il soit suspendu ou que le mot de passe soit faux.
 * Cette uniformité est une décision de sécurité, pas une paresse d'écriture —
 * un message plus précis transformerait la page en annuaire des comptes.
 *
 * Le formulaire fonctionne sans JavaScript : l'action est attachée au `<form>`.
 */
export function FormulaireConnexion() {
  const [etat, action] = useActionState<EtatConnexion, FormData>(seConnecter, ETAT_INITIAL);
  const alerte = useRef<HTMLDivElement>(null);
  const [motDePasseVisible, setMotDePasseVisible] = useState(false);
  const aideVisibilite = useId();

  useEffect(() => {
    if (etat.etat === "refus") alerte.current?.focus();
  }, [etat]);

  return (
    <form action={action} className="mt-8" noValidate>
      {etat.etat === "refus" ? (
        <div
          ref={alerte}
          tabIndex={-1}
          role="alert"
          className="mb-6 rounded-[var(--radius-carte)] border border-[color:var(--color-erreur)] bg-[color:var(--color-erreur-fond)] p-4"
        >
          <p className="m-0 font-semibold text-[color:var(--color-erreur)]">{etat.message}</p>
          {etat.reprendreDansSecondes ? (
            <p className="m-0 mt-2 text-[length:var(--text-aide)] leading-[var(--text-aide--line-height)]">
              Nouvelle tentative possible dans {etat.reprendreDansSecondes} secondes.
            </p>
          ) : null}
        </div>
      ) : null}

      <div className="space-y-6">
        <div>
          <label className="etiquette" htmlFor="code">
            Code établissement
          </label>
          <input
            className="champ uppercase"
            id="code"
            name="code"
            type="text"
            autoCapitalize="characters"
            autoComplete="off"
            spellCheck={false}
            aria-describedby="aide-code"
            defaultValue={etat.saisie?.code ?? ""}
            required
          />
          <span className="aide-champ" id="aide-code">
            Il figure sur la fiche remise par votre lycée. Il identifie
            l&apos;établissement et n&apos;ouvre aucun accès à lui seul.
          </span>
        </div>

        <div>
          <label className="etiquette" htmlFor="identifiant">
            Identifiant
          </label>
          <input
            className="champ"
            id="identifiant"
            name="identifiant"
            type="text"
            autoComplete="username"
            spellCheck={false}
            defaultValue={etat.saisie?.identifiant ?? ""}
            required
          />
        </div>

        <div>
          <label className="etiquette" htmlFor="motDePasse">
            Mot de passe
          </label>
          <div className="relative">
            <input
              className="champ pr-[5.5rem]"
              id="motDePasse"
              name="motDePasse"
              type={motDePasseVisible ? "text" : "password"}
              autoComplete="current-password"
              aria-describedby={aideVisibilite}
              required
            />
            {/* Utile sur un clavier de téléphone, où une faute de frappe reste
                invisible. Le champ repart toujours masqué. */}
            <button
              type="button"
              onClick={() => setMotDePasseVisible((valeur) => !valeur)}
              aria-pressed={motDePasseVisible}
              className="absolute inset-y-0 right-0 flex items-center px-3 text-[length:var(--text-aide)] font-semibold text-[color:var(--color-accent)]"
            >
              {motDePasseVisible ? "Masquer" : "Afficher"}
            </button>
          </div>
          <span className="sr-only" id={aideVisibilite}>
            {motDePasseVisible ? "Le mot de passe est visible." : "Le mot de passe est masqué."}
          </span>
        </div>

        <label className="flex min-h-[var(--spacing-cible)] items-start gap-3">
          <input
            type="checkbox"
            name="postePartage"
            value="oui"
            className="mt-1 size-4 shrink-0 accent-[color:var(--color-accent)]"
          />
          <span>
            Poste partagé
            <span className="aide-champ">
              Session plus courte, rien n&apos;est conservé sur cet ordinateur.
            </span>
          </span>
        </label>
      </div>

      <BoutonConnexion />
    </form>
  );
}

function BoutonConnexion() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className="bouton bouton-primaire mt-8 w-full"
    >
      {pending ? "Vérification…" : "Se connecter"}
    </button>
  );
}
