"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import { verifierSecondFacteur } from "@/app/second-facteur/actions";
import {
  ETAT_SECOND_FACTEUR_INITIAL,
  type EtatSecondFacteur,
} from "@/app/second-facteur/etats";

/**
 * Enrôlement et vérification du second facteur.
 *
 * Un seul écran pour les deux moments, parce que c'est une seule suite de
 * gestes : on ouvre son application, on scanne, on recopie un code. Les couper
 * en deux pages obligerait à revenir en arrière pour relire le QR.
 *
 * Le secret est affiché **une fois**, ici, et l'écran le dit. Il n'est écrit
 * nulle part — ni base, ni journal, ni trace — et personne, pas même
 * l'éditeur, ne peut le retrouver ensuite.
 */
export function SecondFacteur({
  facteurId,
  qrCode,
  secret,
  dejaEnrole,
  destination,
}: {
  facteurId: string;
  qrCode: string | null;
  secret: string | null;
  dejaEnrole: boolean;
  destination: string;
}) {
  const [etat, verifier] = useActionState<EtatSecondFacteur, FormData>(
    verifierSecondFacteur,
    ETAT_SECOND_FACTEUR_INITIAL,
  );

  if (etat.etat === "verifie") {
    return (
      <div className="carte border-[color:var(--color-succes)] bg-[color:var(--color-succes-fond)] p-6">
        <h2 className="m-0 text-[length:var(--text-h3)] leading-[var(--text-h3--line-height)] text-[color:var(--color-succes)]">
          Second facteur actif
        </h2>
        <p className="m-0 mt-2 max-w-[60ch] text-[length:var(--text-tableau)]">
          Cette session est maintenant vérifiée.
          {etat.sessionsFermees !== undefined && etat.sessionsFermees > 0
            ? ` ${etat.sessionsFermees} autre${etat.sessionsFermees > 1 ? "s" : ""} session${
                etat.sessionsFermees > 1 ? "s ont" : " a"
              } été fermée${etat.sessionsFermees > 1 ? "s" : ""} : ${
                etat.sessionsFermees > 1 ? "elles n'avaient" : "elle n'avait"
              } jamais présenté de code.`
            : ""}
        </p>
        <a href={destination} className="bouton bouton-primaire mt-5 inline-flex">
          Continuer
        </a>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {!dejaEnrole && qrCode !== null ? (
        <section aria-labelledby="titre-enrolement" className="carte p-6">
          <h2
            id="titre-enrolement"
            className="m-0 text-[length:var(--text-h3)] leading-[var(--text-h3--line-height)]"
          >
            1. Enregistrez AvecStudy dans votre application
          </h2>
          <p className="m-0 mt-2 max-w-[62ch] text-[length:var(--text-tableau)] text-[color:var(--color-encre-faible)]">
            Ouvrez votre application d&apos;authentification — Google
            Authenticator, Authy, 1Password, le gestionnaire de votre téléphone
            — et scannez cette image.
          </p>

          <div className="mt-5 flex flex-wrap items-start gap-6">
            {/* eslint-disable-next-line @next/next/no-img-element --
                Le fournisseur rend un SVG en « data: » : aucune requête vers
                l'extérieur, et rien à mettre en cache. `next/image` ne sait pas
                optimiser une URI de données, et la router par son proxy
                ajouterait un aller-retour pour rien. */}
            <img
              src={qrCode}
              alt="Code à scanner avec votre application d'authentification"
              width={200}
              height={200}
              className="rounded-[var(--radius-champ)] border border-[color:var(--color-bordure)] bg-white p-2"
            />

            <div className="min-w-0 flex-1">
              <p className="m-0 text-[length:var(--text-aide)] font-semibold uppercase tracking-[0.08em] text-[color:var(--color-encre-tres-faible)]">
                Ou saisissez cette clé à la main
              </p>
              <p
                data-testid="cle-totp"
                className="m-0 mt-2 break-all font-mono text-[length:var(--text-tableau)] font-semibold"
              >
                {secret}
              </p>
              <p className="m-0 mt-3 max-w-[46ch] text-[length:var(--text-aide)] leading-[var(--text-aide--line-height)] text-[color:var(--color-encre-faible)]">
                Cette clé ne sera plus affichée. Elle n&apos;est conservée nulle
                part : si vous perdez votre téléphone sans l&apos;avoir notée,
                il faudra passer par la procédure de récupération.
              </p>
            </div>
          </div>
        </section>
      ) : null}

      <form action={verifier} className="carte p-6">
        <input type="hidden" name="facteur" value={facteurId} />

        <h2 className="m-0 text-[length:var(--text-h3)] leading-[var(--text-h3--line-height)]">
          {dejaEnrole ? "Entrez le code de votre application" : "2. Recopiez le code affiché"}
        </h2>
        <p className="m-0 mt-2 max-w-[62ch] text-[length:var(--text-tableau)] text-[color:var(--color-encre-faible)]">
          Six chiffres, qui changent toutes les trente secondes.
        </p>

        <div className="mt-5 max-w-[14rem]">
          <label className="etiquette" htmlFor="code">
            Code
          </label>
          <input
            id="code"
            name="code"
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="[0-9]{6}"
            maxLength={6}
            required
            autoFocus
            className="champ text-center font-mono text-[1.5rem] tracking-[0.3em]"
          />
        </div>

        {etat.etat === "erreur" ? (
          <p
            role="alert"
            className="m-0 mt-4 rounded-[var(--radius-champ)] border border-[color:var(--color-erreur)] bg-[color:var(--color-erreur-fond)] p-3 text-[length:var(--text-tableau)] text-[color:var(--color-erreur)]"
          >
            {etat.message}
          </p>
        ) : null}

        <BoutonVerifier />
      </form>
    </div>
  );
}

function BoutonVerifier() {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      data-testid="totp-valider"
      disabled={pending}
      className="bouton bouton-primaire mt-5"
    >
      {pending ? "Vérification…" : "Vérifier"}
    </button>
  );
}
