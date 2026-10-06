"use client";

import { useActionState, useState } from "react";
import { BoutonEnvoi, RetourFormulaire, type EtatFormulaire } from "@/components/study/formulaire";
import { utiliserInvitation } from "./actions";

/**
 * Choix du mot de passe à partir d'une invitation. La confirmation
 * d'identité est la vérification prévue par le système : le lien est
 * personnel, remis par l'établissement ; on demande à la personne de
 * confirmer qu'il s'agit bien d'elle avant de poser quoi que ce soit.
 */
export function FormulaireInvitation({ jeton, prenom, compteActif }: { jeton: string; prenom: string; compteActif: boolean }) {
  const [etat, action] = useActionState<EtatFormulaire, FormData>(utiliserInvitation.bind(null, jeton), {});
  const [visible, setVisible] = useState(false);
  const erreur = (c: string) => etat.champs?.[c]?.[0];
  return (
    <form action={action} noValidate className="grid gap-5">
      <RetourFormulaire etat={etat} />
      <label className="flex min-h-[48px] cursor-pointer items-start gap-3 rounded-[12px] border border-[color:var(--color-bordure)] px-4 py-3">
        <input type="checkbox" name="confirme" value="oui" required className="mt-1 size-5 shrink-0 accent-[color:var(--color-accent)]" aria-describedby={erreur("confirme") ? "erreur-confirme" : undefined} />
        <span>
          Je suis {prenom}, et ce lien m&apos;a été remis personnellement.
          {erreur("confirme") ? (
            <span id="erreur-confirme" className="aide-champ font-semibold text-[color:var(--color-erreur)]">
              {erreur("confirme")}
            </span>
          ) : (
            <span className="aide-champ">Sinon, ne continue pas et préviens ton établissement.</span>
          )}
        </span>
      </label>

      <div>
        <label className="etiquette" htmlFor="nouveau">
          {compteActif ? "Nouveau mot de passe" : "Ton mot de passe"}
        </label>
        <div className="relative">
          <input
            id="nouveau"
            name="nouveau"
            type={visible ? "text" : "password"}
            className="champ champ-acces pr-[6rem]"
            autoComplete="new-password"
            minLength={12}
            maxLength={200}
            required
            aria-invalid={erreur("nouveau") ? true : undefined}
            aria-describedby={`aide-nouveau${erreur("nouveau") ? " erreur-nouveau" : ""}`}
          />
          <button
            type="button"
            onClick={() => setVisible((v) => !v)}
            aria-pressed={visible}
            aria-controls="nouveau confirmation"
            className="absolute inset-y-0 right-0 flex min-w-[5.5rem] items-center justify-center px-3 text-[0.875rem] font-semibold text-[color:var(--color-accent)]"
          >
            {visible ? "Masquer" : "Afficher"}
          </button>
        </div>
        {erreur("nouveau") ? (
          <p id="erreur-nouveau" className="aide-champ m-0 font-semibold text-[color:var(--color-erreur)]">
            {erreur("nouveau")}
          </p>
        ) : null}
        <p id="aide-nouveau" className="aide-champ m-0">
          Douze caractères au moins. Une courte phrase facile à retenir fonctionne bien. Personne d&apos;autre ne le connaîtra.
        </p>
      </div>

      <div>
        <label className="etiquette" htmlFor="confirmation">
          Confirmation
        </label>
        <input
          id="confirmation"
          name="confirmation"
          type={visible ? "text" : "password"}
          className="champ champ-acces"
          autoComplete="new-password"
          maxLength={200}
          required
          aria-invalid={erreur("confirmation") ? true : undefined}
          aria-describedby={erreur("confirmation") ? "erreur-confirmation" : undefined}
        />
        {erreur("confirmation") ? (
          <p id="erreur-confirmation" className="aide-champ m-0 font-semibold text-[color:var(--color-erreur)]">
            {erreur("confirmation")}
          </p>
        ) : null}
      </div>

      <label className="flex min-h-[48px] cursor-pointer items-start gap-3">
        <input type="checkbox" name="postePartage" value="oui" className="mt-1 size-5 shrink-0 accent-[color:var(--color-accent)]" />
        <span>
          <span className="block font-semibold">Appareil partagé</span>
          <span className="aide-champ m-0 mt-0.5">Pour un ordinateur du lycée ou utilisé par plusieurs personnes.</span>
        </span>
      </label>

      <BoutonEnvoi enCours="Activation…" className="bouton-acces w-full">
        {compteActif ? "Enregistrer et me connecter" : "Activer mon accès"}
      </BoutonEnvoi>
    </form>
  );
}
