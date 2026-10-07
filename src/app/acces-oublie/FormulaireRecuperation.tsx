"use client";

import Link from "next/link";
import { useActionState, useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import { demanderRecuperation, type EtatRecuperation } from "./actions";

export function FormulaireRecuperation({ etablissement, etatInitial }: { etablissement: string | null; /** Aperçus de développement seulement. */ etatInitial?: EtatRecuperation }) {
  const [etat, action] = useActionState<EtatRecuperation, FormData>(demanderRecuperation, etatInitial ?? { etat: "vierge" });
  const titre = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    if (etat.etat === "envoyee") titre.current?.focus();
  }, [etat.etat]);

  if (etat.etat === "envoyee") {
    return (
      <section aria-labelledby="accuse" className="rounded-[12px] border border-[color:var(--color-bordure)] p-5">
        <h2 id="accuse" ref={titre} tabIndex={-1} className="m-0 text-[1.25rem] outline-none">
          Demande enregistrée
        </h2>
        <p className="m-0 mt-2">
          Si ces informations correspondent à un compte, l&apos;administration {etat.etablissement ? `de ${etat.etablissement}` : "de ton établissement"} voit
          ta demande. Par sécurité, cet écran ne dit pas si le compte existe.
        </p>
        <p className="m-0 mt-4 text-[0.875rem] text-[color:var(--color-encre-faible)]">Référence de ta demande</p>
        <p className="m-0 font-mono text-[1.5rem] font-bold tracking-[0.08em]" data-testid="reference-demande">
          {etat.reference}
        </p>
        <p className="m-0 mt-1 text-[0.9375rem] font-semibold">Conserve cette référence pour le suivi de ta demande.</p>
        <h3 className="m-0 mt-5 text-[1rem]">Et maintenant ?</h3>
        <ol className="m-0 mt-2 grid gap-1.5 pl-5 text-[0.9375rem]">
          <li>Présente-toi à la vie scolaire ou au secrétariat, avec cette référence.</li>
          <li>On vérifie ton identité (carte de lycéen ou pièce d&apos;identité, ou ta présence connue de l&apos;équipe).</li>
          <li>On te remet un lien personnel, valable 7 jours au plus et à usage unique, pour choisir un nouveau mot de passe.</li>
        </ol>
        <p className="meta m-0 mt-4">Personne ne te demandera ton mot de passe, ni par message ni par téléphone.</p>
        <Link href="/connexion" className="bouton bouton-secondaire bouton-acces mt-5 w-full">
          Retour à la connexion
        </Link>
      </section>
    );
  }

  const erreur = (c: "code" | "identifiant") => etat.champs?.[c];
  return (
    <form action={action} noValidate className="grid gap-5">
      {etat.etat === "refus" && !etat.champs ? (
        <p role="alert" className="m-0 rounded-[12px] bg-[color:var(--color-attention-fond)] p-4 font-semibold text-[color:var(--color-attention)]">
          {etat.message}
        </p>
      ) : null}
      {etablissement === null ? (
        <div>
          <label className="etiquette" htmlFor="code">
            Code établissement
          </label>
          <input
            id="code"
            name="code"
            className="champ champ-acces uppercase"
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            maxLength={16}
            defaultValue={etat.valeurs?.code ?? ""}
            aria-invalid={erreur("code") ? true : undefined}
            aria-describedby={erreur("code") ? "erreur-code" : "aide-code"}
          />
          {erreur("code") ? (
            <p id="erreur-code" role="alert" className="aide-champ m-0 font-semibold text-[color:var(--color-erreur)]">
              {erreur("code")}
            </p>
          ) : (
            <p id="aide-code" className="aide-champ m-0">
              Il figure sur ta fiche de connexion.
            </p>
          )}
        </div>
      ) : null}
      <div>
        <label className="etiquette" htmlFor="identifiant">
          Identifiant
        </label>
        <input
          id="identifiant"
          name="identifiant"
          className="champ champ-acces"
          autoComplete="username"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          maxLength={40}
          defaultValue={etat.valeurs?.identifiant ?? ""}
          aria-invalid={erreur("identifiant") ? true : undefined}
          aria-describedby={erreur("identifiant") ? "erreur-identifiant" : undefined}
        />
        {erreur("identifiant") ? (
          <p id="erreur-identifiant" role="alert" className="aide-champ m-0 font-semibold text-[color:var(--color-erreur)]">
            {erreur("identifiant")}
          </p>
        ) : null}
      </div>
      <Envoyer />
    </form>
  );
}

function Envoyer() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="bouton bouton-primaire bouton-acces w-full">
      {pending ? "Envoi…" : "Demander un nouvel accès"}
    </button>
  );
}
