"use client";

import { useActionState, useState } from "react";
import Link from "next/link";
import { DemandeLien, UtiliserCode } from "./AccesCourriel";
import { inscrireProfesseur } from "./actions";
import { ETAT_INSCRIPTION_PROFESSEUR, type EtatInscriptionProfesseur } from "./etats";

type NomChamp = "prenom" | "nom" | "email" | "motDePasse" | "confirmation";
function ChampInscription({ nom, label, erreurs, valeur, type = "text", autoComplete }: { nom: NomChamp; label: string; erreurs?: EtatInscriptionProfesseur["champs"]; valeur?: string; type?: string; autoComplete?: string }) {
  return <div><label className="etiquette" htmlFor={nom}>{label}</label><input className="champ champ-acces" id={nom} name={nom} type={type} autoComplete={autoComplete} defaultValue={valeur} required aria-invalid={erreurs?.[nom] ? true : undefined} />{erreurs?.[nom] ? <p className="aide-champ font-semibold text-[color:var(--color-erreur)]">{erreurs[nom]}</p> : null}</div>;
}

export function FormulaireInscriptionProfesseur() {
  const [etat, action, attente] = useActionState(inscrireProfesseur, ETAT_INSCRIPTION_PROFESSEUR);
  const [aCorriger, setACorriger] = useState<EtatInscriptionProfesseur | null>(null);
  if (etat.etat === "envoyee" && etat !== aCorriger) {
    return (
      <>
        <p role="status" className="rounded bg-[color:var(--color-succes-fond)] p-4">{etat.message}</p>
        <UtiliserCode adresse={etat.valeurs?.email} />
        <DemandeLien mode="confirmation" adresse={etat.valeurs?.email} />
        <button type="button" className="bouton bouton-discret mt-3" onClick={() => setACorriger(etat)}>Corriger mon adresse</button>
      </>
    );
  }
  return (
    <form action={action} className="grid gap-4" noValidate>
      {etat.etat === "refus" ? <p role="alert" className="m-0 rounded bg-[color:var(--color-attention-fond)] p-3">{etat.message}</p> : null}
      <div className="grid grid-cols-2 gap-3">
        <ChampInscription nom="prenom" label="Prénom" autoComplete="given-name" erreurs={etat.champs} valeur={etat.valeurs?.prenom} />
        <ChampInscription nom="nom" label="Nom" autoComplete="family-name" erreurs={etat.champs} valeur={etat.valeurs?.nom} />
      </div>
      <ChampInscription nom="email" label="E-mail" type="email" autoComplete="email" erreurs={etat.champs} valeur={etat.valeurs?.email} />
      <ChampInscription nom="motDePasse" label="Mot de passe" type="password" autoComplete="new-password" erreurs={etat.champs} />
      <p className="aide-champ -mt-3">Au moins 12 caractères. Une phrase courte convient.</p>
      <ChampInscription nom="confirmation" label="Confirmer le mot de passe" type="password" autoComplete="new-password" erreurs={etat.champs} />
      <button className="bouton bouton-primaire bouton-acces w-full" disabled={attente}>{attente ? "Création…" : "Créer mon compte"}</button>
      <Link href="/inscription/professeur/acces?mode=confirmation" className="text-center underline">J’ai déjà reçu un code de confirmation</Link>
    </form>
  );
}
