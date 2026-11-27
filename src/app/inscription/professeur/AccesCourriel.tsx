"use client";

import { useActionState } from "react";
import { confirmerAdresse, confirmerCodeProfesseur, envoyerLienProfesseur, reinitialiserProfesseur } from "./actions";
import { ETAT_INSCRIPTION_PROFESSEUR } from "./etats";
import { CodeConfirmation } from "@/components/study/connexion/CodeConfirmation";

export function DemandeLien({ mode, adresse }: { mode: "confirmation" | "recuperation"; adresse?: string }) {
  const [etat, action, attente] = useActionState(envoyerLienProfesseur.bind(null, mode), ETAT_INSCRIPTION_PROFESSEUR);
  return (
    <form action={action} className="mt-4 grid gap-3">
      <label className="etiquette">Adresse e-mail du compte
        <input className="champ champ-acces mt-1" name="email" type="email" autoComplete="email" defaultValue={adresse} required maxLength={180} />
      </label>
      <button className="bouton bouton-secondaire" disabled={attente}>
        {attente ? "Envoi demandé…" : mode === "confirmation" ? "Renvoyer un code" : "Demander un lien de récupération"}
      </button>
      {etat.message ? <p role={etat.etat === "refus" ? "alert" : "status"} className="m-0">{etat.message}</p> : null}
    </form>
  );
}

export function UtiliserCode({ adresse }: { adresse?: string }) {
  const [etat, action, attente] = useActionState(confirmerCodeProfesseur, ETAT_INSCRIPTION_PROFESSEUR);
  return (
    <section aria-labelledby="confirmation-code-titre" className="rounded-xl border border-[color:var(--color-bordure)] bg-[color:var(--color-surface)] p-4 sm:p-5">
      <h2 id="confirmation-code-titre" className="m-0 text-lg font-bold text-[color:var(--color-encre)]">Ton code de confirmation</h2>
      <p className="mt-2 text-sm text-[color:var(--color-encre-faible)]">Recopie les 6 chiffres du mail AvecStudy pour activer ton espace professeur. Aucun lien à ouvrir.</p>
      <form action={action} className="mt-4 grid gap-4">
        <label className="etiquette" htmlFor="confirmation-code-email">Adresse e-mail du compte</label>
        <input id="confirmation-code-email" className="champ champ-acces -mt-3" name="email" type="email" autoComplete="email" defaultValue={adresse} maxLength={180} required />
        <label className="etiquette" htmlFor="confirmation-code-valeur">Code à 6 chiffres</label>
        <div className="max-w-[380px]"><CodeConfirmation id="confirmation-code-valeur" invalide={etat.etat === "refus"} attente={attente} /></div>
        {etat.message ? <p role="alert" className="m-0 text-sm text-[color:var(--color-erreur)]">{etat.message}</p> : null}
        <button className="bouton bouton-primaire w-full" disabled={attente}>
          {attente ? "Vérification en cours…" : "Valider mon adresse e-mail"}
        </button>
      </form>
    </section>
  );
}

export function UtiliserLien({ mode, jeton }: { mode: "confirmation" | "recuperation"; jeton: string }) {
  const serveur = mode === "confirmation" ? confirmerAdresse.bind(null, jeton) : reinitialiserProfesseur.bind(null, jeton);
  const [etat, action, attente] = useActionState(serveur, ETAT_INSCRIPTION_PROFESSEUR);
  return (
    <form action={action} className="grid gap-4">
      {mode === "recuperation" ? (
        <>
          <label className="etiquette">Nouveau mot de passe
            <input className="champ champ-acces mt-1" name="motDePasse" type="password" autoComplete="new-password" minLength={12} maxLength={200} required />
          </label>
          <label className="etiquette">Confirmer le nouveau mot de passe
            <input className="champ champ-acces mt-1" name="confirmation" type="password" autoComplete="new-password" minLength={12} maxLength={200} required />
          </label>
        </>
      ) : null}
      {etat.message ? <p role="alert" className="m-0">{etat.message}</p> : null}
      <button className="bouton bouton-primaire" disabled={attente}>
        {attente ? "Vérification…" : mode === "confirmation" ? "Confirmer mon adresse" : "Enregistrer le nouveau mot de passe"}
      </button>
    </form>
  );
}
