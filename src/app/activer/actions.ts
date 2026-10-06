"use server";

import { redirect } from "next/navigation";
import { jetonDepuisLien } from "@/lib/v6/contexte-etablissement";

export interface EtatLien {
  readonly message?: string;
  readonly valeur?: string;
}

/** Un lien d'invitation collé : seule la forme est vérifiée ici, l'état se lit sur la page d'invitation. */
export async function ouvrirInvitation(_p: EtatLien, donnees: FormData): Promise<EtatLien> {
  const valeur = String(donnees.get("lien") ?? "").slice(0, 400);
  const jeton = jetonDepuisLien(valeur);
  if (jeton === null) {
    return { message: "Ce n'est pas un lien d'invitation Study. Copie-le en entier depuis le message reçu.", valeur };
  }
  redirect(`/invitation/${jeton}`);
}
