"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { jetonAccesDe, sessionCourante } from "@/lib/session-serveur";
import { clientUtilisateur } from "@/lib/supabase-serveur";

export interface EtatCreationClasse { readonly ok?: boolean; readonly message?: string }

const schema = z.object({ classe: z.string().trim().min(2).max(80), matiere: z.string().trim().min(2).max(80) });

export async function creerClasse(_precedent: EtatCreationClasse, donnees: FormData): Promise<EtatCreationClasse> {
  const personne = await sessionCourante();
  if (!personne) redirect("/connexion");
  const jeton = await jetonAccesDe(personne);
  if (!jeton) redirect("/connexion?motif=expiree");
  const saisie = schema.safeParse({ classe: donnees.get("classe"), matiere: donnees.get("matiere") });
  if (!saisie.success) return { ok: false, message: "Indique le nom de la classe et une matière." };
  const { data, error } = await clientUtilisateur(jeton).rpc("classe_autonome_creer", {
    p_organisation: personne.organizationId,
    p_libelle: saisie.data.classe,
    p_matiere: saisie.data.matiere,
  });
  if (error) return { ok: false, message: "La classe n’a pas pu être créée. Vérifie les informations puis réessaie." };
  const classe = ((data ?? []) as { classe: string }[])[0]?.classe;
  redirect(classe ? `/professeur/classes?classe=${classe}` : "/professeur/classes");
}
