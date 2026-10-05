"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { jetonAccesDe, sessionCourante } from "@/lib/session-serveur";
import { clientUtilisateur } from "@/lib/supabase-serveur";
import { versConnexion } from "@/lib/v6/redirection";

/** Annuler sa propre demande en attente ; la base vérifie l'auteur et l'état. */
export async function annulerDemande(donnees: FormData): Promise<void> {
  const personne = await sessionCourante();
  if (personne === null) redirect(versConnexion("/acces-en-attente"));
  const jeton = await jetonAccesDe(personne);
  if (jeton === null) redirect(versConnexion("/acces-en-attente", "expiree"));
  const demande = z.string().uuid().safeParse(String(donnees.get("demande") ?? ""));
  if (demande.success) {
    await clientUtilisateur(jeton).rpc("classe_annuler_demande", { p_demande: demande.data });
  }
  redirect("/acces-en-attente");
}
