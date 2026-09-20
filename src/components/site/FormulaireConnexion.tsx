"use client";

import { useActionState, useEffect, useId, useRef, useState } from "react";
import { useFormStatus } from "react-dom";
import { seConnecter } from "@/app/connexion/actions";
import { ETAT_INITIAL, type EtatConnexion } from "@/app/connexion/etats";

/**
 * Formulaire de connexion.
 *
 * Deux sortes de messages, et il ne faut jamais les confondre.
 *
 * **Ce qui manque** se dit précisément : « Indiquez votre identifiant ». C'est
 * une faute de saisie, elle n'apprend rien à personne, et la taire ferait
 * perdre du temps à quelqu'un qui a simplement oublié un champ.
 *
 * **Ce qui est faux** se dit toujours de la même façon, que le compte existe
 * ou non, qu'il soit suspendu ou que le mot de passe soit erroné. Cette
 * uniformité est une décision de sécurité : un message plus précis
 * transformerait la page en annuaire des comptes d'un lycée.
 *
 * Le contrôle des champs vides a lieu **avant** tout envoi. C'est le §4 du
 * cahier, et c'était un vrai défaut : le formulaire porte `noValidate` — pour
 * écrire ses propres messages plutôt que ceux du navigateur — mais rien ne
 * remplaçait la validation native. Un formulaire entièrement vide partait donc
 * au serveur, et revenait avec le message générique, qui laissait croire à un
 * mauvais mot de passe.
 *
 * Sans JavaScript, le formulaire reste utilisable : l'action est attachée au
 * `<form>`, et un envoi vide reçoit le refus du serveur.
 */

type Champ = "code" | "identifiant" | "motDePasse";

const MANQUE: Record<Champ, string> = {
  code: "Indiquez le code de votre établissement.",
  identifiant: "Indiquez votre identifiant.",
  motDePasse: "Indiquez votre mot de passe.",
};

const ORDRE: readonly Champ[] = ["code", "identifiant", "motDePasse"];

export function FormulaireConnexion() {
  const [etat, action] = useActionState<EtatConnexion, FormData>(seConnecter, ETAT_INITIAL);
  const alerte = useRef<HTMLDivElement>(null);
  const formulaire = useRef<HTMLFormElement>(null);
  const [motDePasseVisible, setMotDePasseVisible] = useState(false);
  const [manquants, setManquants] = useState<readonly Champ[]>([]);
  const aideVisibilite = useId();
  const prefixe = useId();

  const identifiantErreur = (champ: Champ) => `${prefixe}-erreur-${champ}`;

  useEffect(() => {
    if (etat.etat === "refus") alerte.current?.focus();
  }, [etat]);

  /**
   * Arrête l'envoi tant qu'un champ obligatoire est vide.
   *
   * `preventDefault` empêche React d'appeler l'action serveur : aucune requête
   * d'authentification ne part, et la limitation de tentatives côté serveur
   * n'est pas consommée par une faute de frappe.
   */
  function verifier(evenement: React.FormEvent<HTMLFormElement>) {
    const donnees = new FormData(evenement.currentTarget);
    const vides = ORDRE.filter((champ) => String(donnees.get(champ) ?? "").trim() === "");

    setManquants(vides);
    if (vides.length === 0) return;

    evenement.preventDefault();

    // Le focus va au premier champ fautif, dans l'ordre de lecture — pas au
    // résumé : on veut que la personne puisse taper tout de suite.
    const premier = vides[0];
    if (premier !== undefined) {
      formulaire.current?.querySelector<HTMLInputElement>(`#${CSS.escape(premier)}`)?.focus();
    }
  }

  const estManquant = (champ: Champ) => manquants.includes(champ);

  /** Les attributs communs à un champ obligatoire, selon qu'il manque ou non. */
  function attributs(champ: Champ, aideExistante?: string) {
    const decrit = [aideExistante, estManquant(champ) ? identifiantErreur(champ) : null]
      .filter((valeur) => valeur !== null && valeur !== undefined)
      .join(" ");

    return {
      "aria-invalid": estManquant(champ) ? (true as const) : undefined,
      "aria-describedby": decrit === "" ? undefined : decrit,
    };
  }

  return (
    <form ref={formulaire} action={action} onSubmit={verifier} className="mt-8" noValidate>
      {manquants.length > 0 ? (
        <div
          role="alert"
          className="mb-6 rounded-[var(--radius-carte)] border border-[color:var(--color-erreur)] bg-[color:var(--color-erreur-fond)] p-4"
        >
          <p className="m-0 font-semibold text-[color:var(--color-erreur)]">
            {manquants.length === 1
              ? "Un champ est vide."
              : `${manquants.length} champs sont vides.`}
          </p>
          <ul className="m-0 mt-2 list-disc space-y-1 pl-5 text-[length:var(--text-aide)]">
            {manquants.map((champ) => (
              <li key={champ}>{MANQUE[champ]}</li>
            ))}
          </ul>
        </div>
      ) : null}

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
            autoComplete="organization"
            spellCheck={false}
            defaultValue={etat.saisie?.code ?? ""}
            required
            {...attributs("code", "aide-code")}
          />
          {estManquant("code") ? (
            <span className="aide-champ text-[color:var(--color-erreur)]" id={identifiantErreur("code")}>
              {MANQUE.code}
            </span>
          ) : null}
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
            {...attributs("identifiant")}
          />
          {estManquant("identifiant") ? (
            <span
              className="aide-champ text-[color:var(--color-erreur)]"
              id={identifiantErreur("identifiant")}
            >
              {MANQUE.identifiant}
            </span>
          ) : null}
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
              required
              {...attributs("motDePasse", aideVisibilite)}
            />
            {/* Utile sur un clavier de téléphone, où une faute de frappe reste
                invisible. Le champ repart toujours masqué. */}
            <button
              type="button"
              onClick={() => setMotDePasseVisible((valeur) => !valeur)}
              aria-pressed={motDePasseVisible}
              aria-controls="motDePasse"
              className="absolute inset-y-0 right-0 flex items-center px-3 text-[length:var(--text-aide)] font-semibold text-[color:var(--color-accent)]"
            >
              {motDePasseVisible ? "Masquer" : "Afficher"}
            </button>
          </div>
          {estManquant("motDePasse") ? (
            <span
              className="aide-champ text-[color:var(--color-erreur)]"
              id={identifiantErreur("motDePasse")}
            >
              {MANQUE.motDePasse}
            </span>
          ) : null}
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
