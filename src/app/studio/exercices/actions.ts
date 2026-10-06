"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import type { EtatFormulaire } from "@/components/study/formulaire";
import { jetonAccesDe, sessionCourante } from "@/lib/session-serveur";
import { clientUtilisateur } from "@/lib/supabase-serveur";
import { idRequete } from "@/lib/v6/contexte";
import { traduire } from "@/lib/v6/erreurs";
import { versConnexion } from "@/lib/v6/redirection";

/** Ajouter un exercice de la banque à une séance : copie non publiée (0060), droits vérifiés en base. */
export async function ajouterASeance(version: string, _p: EtatFormulaire, donnees: FormData): Promise<EtatFormulaire> {
  const lecon = z.string().uuid().safeParse(String(donnees.get("lecon") ?? ""));
  if (!z.string().uuid().safeParse(version).success) return { ok: false, message: "Exercice invalide." };
  if (!lecon.success) return { ok: false, message: "Choisissez la séance.", champs: { lecon: ["Choix requis."] } };
  const personne = await sessionCourante();
  if (personne === null) redirect(versConnexion("/studio/exercices", "expiree"));
  const jeton = await jetonAccesDe(personne);
  if (jeton === null) redirect(versConnexion("/studio/exercices", "expiree"));
  const requestId = idRequete();
  const { error } = await clientUtilisateur(jeton).rpc("exercice_ajouter_a_seance", { p_version: version, p_lecon: lecon.data });
  if (error !== null) return { ok: false, message: traduire(error, requestId).message, requestId };
  redirect(`/studio/${lecon.data}/exercices?ajoute=1`);
}
