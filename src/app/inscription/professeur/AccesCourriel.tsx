"use client";

import { useActionState } from "react";
import { confirmerAdresse, envoyerLienProfesseur, reinitialiserProfesseur } from "./actions";
import { ETAT_INSCRIPTION_PROFESSEUR } from "./etats";

export function DemandeLien({ mode, adresse }: { mode: "confirmation" | "recuperation"; adresse?: string }) {
  const [etat, action, attente] = useActionState(envoyerLienProfesseur.bind(null, mode), ETAT_INSCRIPTION_PROFESSEUR);
  return (
    <form action={action} className="mt-4 grid gap-3">
      <label className="etiquette">Adresse e-mail du compte
        <input className="champ champ-acces mt-1" name="email" type="email" autoComplete="email" defaultValue={adresse} required maxLength={180} />
      </label>
      <button className="bouton bouton-secondaire" disabled={attente}>
        {attente ? "Envoi demandé…" : mode === "confirmation" ? "Renvoyer le lien de confirmation" : "Demander un lien de récupération"}
      </button>
      {etat.message ? <p role={etat.etat === "refus" ? "alert" : "status"} className="m-0">{etat.message}</p> : null}
    </form>
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
