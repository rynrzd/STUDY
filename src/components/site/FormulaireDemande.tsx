"use client";

import { useActionState, useEffect, useId, useRef } from "react";
import { useFormStatus } from "react-dom";
import { deposerDemande } from "@/app/(public)/(site)/etablissements/actions";
import { ETAT_INITIAL, type EtatFormulaire } from "@/app/(public)/(site)/etablissements/etats";
import { TYPES_ETABLISSEMENT } from "@/lib/demande-commerciale";

/**
 * Formulaire de demande de démonstration ou de devis.
 *
 * Il fonctionne sans JavaScript : c'est une action serveur attachée à un
 * `<form>`, donc une soumission classique si le script n'a pas chargé. Le
 * script n'ajoute que le confort — bouton désactivé pendant l'envoi, focus
 * porté sur la confirmation, erreurs annoncées.
 *
 * Aucune promesse d'e-mail n'est faite nulle part : la confirmation affiche une
 * référence, et c'est cette référence qui sert de preuve de dépôt.
 */

export function FormulaireDemande({ ouverture }: { ouverture: string }) {
  const [etat, action] = useActionState<EtatFormulaire, FormData>(deposerDemande, ETAT_INITIAL);
  const confirmation = useRef<HTMLDivElement>(null);
  const resume = useRef<HTMLDivElement>(null);
  const base = useId();

  useEffect(() => {
    if (etat.etat === "envoye") confirmation.current?.focus();
    if (etat.etat === "erreur" || etat.etat === "indisponible") resume.current?.focus();
  }, [etat]);

  if (etat.etat === "envoye") {
    return (
      <div
        ref={confirmation}
        tabIndex={-1}
        className="carte p-7 md:p-8"
        role="status"
        aria-live="polite"
      >
        <p className="surtitre m-0">Demande enregistrée</p>
        <h2 className="mt-4 text-[length:var(--text-h2)] leading-[var(--text-h2--line-height)]">
          {etat.dejaRecue
            ? "Nous avions déjà reçu cette demande."
            : "Votre demande a bien été enregistrée."}
        </h2>

        <p className="mt-5 m-0 text-[color:var(--color-encre-faible)]">
          Référence :{" "}
          <strong className="font-mono text-[length:var(--text-grand)] font-semibold text-[color:var(--color-encre)]">
            {etat.reference}
          </strong>
        </p>

        <p className="mt-5 m-0 text-[color:var(--color-encre-faible)]">
          Notez cette référence : aucun courrier de confirmation n&apos;est
          envoyé. Elle nous permet de retrouver votre demande si vous nous
          appelez. Nous revenons vers vous à l&apos;adresse professionnelle
          indiquée.
        </p>
      </div>
    );
  }

  return (
    <form
      action={action}
      noValidate
      data-testid="demande-formulaire"
      className="space-y-8"
      aria-describedby={`${base}-information`}
    >
      <input type="hidden" name="ouverture" value={ouverture} />

      {/* Champ leurre : masqué à l'œil et au lecteur d'écran, laissé vide. */}
      <div aria-hidden="true" className="absolute left-[-9999px] top-0 h-0 w-0 overflow-hidden">
        <label htmlFor={`${base}-organisme`}>Organisme</label>
        <input id={`${base}-organisme`} name="organisme" type="text" tabIndex={-1} autoComplete="off" />
      </div>

      {(etat.etat === "erreur" || etat.etat === "indisponible") && etat.message ? (
        <div
          ref={resume}
          tabIndex={-1}
          role="alert"
          className="rounded-[var(--radius-carte)] border border-[color:var(--color-erreur)] bg-[color:var(--color-erreur-fond)] p-4"
        >
          <p className="m-0 font-semibold text-[color:var(--color-erreur)]">{etat.message}</p>
        </div>
      ) : null}

      <fieldset className="m-0 border-0 p-0">
        <legend className="text-[length:var(--text-h3)] font-bold leading-[var(--text-h3--line-height)]">
          L&apos;établissement
        </legend>

        <div className="mt-6 space-y-6">
          <Champ
            id={`${base}-etablissement`}
            nom="etablissement"
            etiquette="Nom de l'établissement"
            autoComplete="organization"
            requis
            erreur={etat.champs?.etablissement}
          />

          <fieldset className="m-0 border-0 p-0">
            <legend className="etiquette">Type d&apos;établissement</legend>
            <div className="mt-1 flex flex-wrap gap-x-6 gap-y-2">
              {TYPES_ETABLISSEMENT.map((type) => (
                <label
                  key={type.valeur}
                  className="inline-flex min-h-[var(--spacing-cible)] items-center gap-2.5"
                >
                  <input
                    type="radio"
                    name="type"
                    value={type.valeur}
                    defaultChecked={type.valeur === "public"}
                    className="size-4 accent-[color:var(--color-accent)]"
                  />
                  {type.libelle}
                </label>
              ))}
            </div>
            {etat.champs?.type ? <span className="erreur-champ">{etat.champs.type}</span> : null}
          </fieldset>

          <div className="grid gap-6 sm:grid-cols-2">
            <Champ
              id={`${base}-commune`}
              nom="commune"
              etiquette="Commune"
              autoComplete="address-level2"
              requis
              erreur={etat.champs?.commune}
            />
            <Champ
              id={`${base}-effectif`}
              nom="effectif"
              etiquette="Nombre approximatif d'élèves"
              type="number"
              inputMode="numeric"
              aide="Un ordre de grandeur suffit. Il sert à établir le devis, pas à facturer."
              erreur={etat.champs?.effectif}
            />
          </div>
        </div>
      </fieldset>

      <fieldset className="m-0 border-0 p-0">
        <legend className="text-[length:var(--text-h3)] font-bold leading-[var(--text-h3--line-height)]">
          Votre contact
        </legend>

        <div className="mt-6 space-y-6">
          <div className="grid gap-6 sm:grid-cols-2">
            <Champ
              id={`${base}-nom`}
              nom="contactNom"
              etiquette="Nom et prénom"
              autoComplete="name"
              requis
              erreur={etat.champs?.contactNom}
            />
            <Champ
              id={`${base}-fonction`}
              nom="contactFonction"
              etiquette="Fonction"
              autoComplete="organization-title"
              requis
              erreur={etat.champs?.contactFonction}
            />
          </div>

          <div className="grid gap-6 sm:grid-cols-2">
            <Champ
              id={`${base}-email`}
              nom="contactEmail"
              etiquette="Adresse professionnelle"
              type="email"
              autoComplete="email"
              requis
              erreur={etat.champs?.contactEmail}
            />
            <Champ
              id={`${base}-telephone`}
              nom="contactTelephone"
              etiquette="Téléphone"
              type="tel"
              autoComplete="tel"
              facultatif
              erreur={etat.champs?.contactTelephone}
            />
          </div>

          <Champ
            id={`${base}-besoin`}
            nom="besoin"
            etiquette="Votre besoin"
            multiligne
            requis
            aide="Combien de classes, quel équipement, quelle échéance. Ne joignez aucune liste d'élèves : elle ne serait ni nécessaire, ni conservée."
            erreur={etat.champs?.besoin}
          />

          <div>
            <label className="flex items-start gap-3">
              <input
                type="checkbox"
                name="consentement"
                value="oui"
                className="mt-1 size-4 shrink-0 accent-[color:var(--color-accent)]"
              />
              <span className="text-[length:var(--text-tableau)] leading-[var(--text-tableau--line-height)]">
                J&apos;accepte d&apos;être recontacté à l&apos;adresse
                professionnelle indiquée, au sujet de cette demande.
              </span>
            </label>
            {etat.champs?.consentement ? (
              <span className="erreur-champ">{etat.champs.consentement}</span>
            ) : null}
          </div>
        </div>
      </fieldset>

      <BoutonEnvoi />

      <p
        id={`${base}-information`}
        className="m-0 max-w-[68ch] text-[length:var(--text-aide)] leading-[var(--text-aide--line-height)] text-[color:var(--color-encre-faible)]"
      >
        Ces informations servent uniquement à répondre à votre demande et à
        établir un devis. Elles sont conservées trois ans après notre dernier
        contact, puis supprimées. Aucune donnée d&apos;élève n&apos;est demandée
        à cette étape, aucune case n&apos;est pré-cochée, et aucun courrier
        automatique n&apos;est envoyé.
      </p>
    </form>
  );
}

/* -------------------------------------------------------------------------- */

function BoutonEnvoi() {
  const { pending } = useFormStatus();
  return (
    <div>
      <button
      type="submit"
      data-testid="demande-envoyer"
      disabled={pending}
      className="bouton bouton-primaire"
    >
        {pending ? "Envoi en cours…" : "Envoyer la demande"}
        {pending ? null : (
          <span aria-hidden="true" className="fleche">
            →
          </span>
        )}
      </button>
    </div>
  );
}

function Champ({
  id,
  nom,
  etiquette,
  type = "text",
  autoComplete,
  inputMode,
  aide,
  erreur,
  requis = false,
  facultatif = false,
  multiligne = false,
}: {
  id: string;
  nom: string;
  etiquette: string;
  type?: string;
  autoComplete?: string;
  inputMode?: "numeric" | "text";
  aide?: string;
  erreur?: string;
  requis?: boolean;
  facultatif?: boolean;
  multiligne?: boolean;
}) {
  const decrit = [aide ? `${id}-aide` : null, erreur ? `${id}-erreur` : null]
    .filter((valeur) => valeur !== null)
    .join(" ");

  const communs = {
    id,
    name: nom,
    required: requis,
    "aria-invalid": erreur ? (true as const) : undefined,
    "aria-describedby": decrit === "" ? undefined : decrit,
    className: "champ",
  };

  return (
    <div>
      <label className="etiquette" htmlFor={id}>
        {etiquette}
        {facultatif ? (
          <span className="font-normal text-[color:var(--color-encre-faible)]"> (facultatif)</span>
        ) : null}
      </label>

      {multiligne ? (
        <textarea {...communs} rows={5} className="champ min-h-[132px] py-2.5" />
      ) : (
        <input {...communs} type={type} autoComplete={autoComplete} inputMode={inputMode} />
      )}

      {aide ? (
        <span className="aide-champ" id={`${id}-aide`}>
          {aide}
        </span>
      ) : null}
      {erreur ? (
        <span className="erreur-champ" id={`${id}-erreur`}>
          {erreur}
        </span>
      ) : null}
    </div>
  );
}
