"use client";

import { useActionState } from "react";
import { useFormStatus } from "react-dom";
import type { EtatLien } from "./actions";

export function FormulaireLien({ action }: { action: (p: EtatLien, d: FormData) => Promise<EtatLien> }) {
  const [etat, envoyer] = useActionState<EtatLien, FormData>(action, {});
  return (
    <form action={envoyer} noValidate className="mt-3">
      <label className="etiquette" htmlFor="lien-invitation">
        Lien d&apos;invitation
      </label>
      <input
        id="lien-invitation"
        name="lien"
        type="url"
        inputMode="url"
        className="champ champ-acces"
        autoComplete="off"
        spellCheck={false}
        maxLength={400}
        defaultValue={etat.valeur ?? ""}
        placeholder="https://…/invitation/…"
        aria-invalid={etat.message ? true : undefined}
        aria-describedby={etat.message ? "erreur-lien" : undefined}
      />
      {etat.message ? (
        <p id="erreur-lien" role="alert" className="aide-champ m-0 font-semibold text-[color:var(--color-erreur)]">
          {etat.message}
        </p>
      ) : null}
      <Ouvrir />
    </form>
  );
}

function Ouvrir() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="bouton bouton-primaire bouton-acces mt-3 w-full">
      {pending ? "Ouverture…" : "Ouvrir mon invitation"}
    </button>
  );
}
