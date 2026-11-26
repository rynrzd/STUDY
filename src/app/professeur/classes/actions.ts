"use server";

import { redirect } from "next/navigation";
import { z } from "zod";
import { jetonAccesDe, sessionCourante } from "@/lib/session-serveur";
import { clientUtilisateur } from "@/lib/supabase-serveur";
import { document as lireDocument } from "@/lib/studio-documents";

export interface EtatCreationClasse { readonly ok?: boolean; readonly message?: string }

const schema = z.object({ classe: z.string().trim().min(2).max(80), matiere: z.string().trim().min(2).max(80) });

export async function creerClasse(_precedent: EtatCreationClasse, donnees: FormData): Promise<EtatCreationClasse> {
  const personne = await sessionCourante();
  if (!personne) redirect("/connexion");
  const jeton = await jetonAccesDe(personne);
  if (!jeton) redirect("/connexion?motif=expiree");
  const saisie = schema.safeParse({ classe: donnees.get("classe"), matiere: donnees.get("matiere") });
  if (!saisie.success) return { ok: false, message: "Indique le nom de la classe et une matière." };
  const retour = z.object({ document: z.uuid(), revision: z.uuid() }).safeParse({
    document: donnees.get("document"),
    revision: donnees.get("revision"),
  });
  if (retour.success) {
    const brouillon = await lireDocument(jeton, retour.data.document);
    if (brouillon?.revisionId !== retour.data.revision) {
      return { ok: false, message: "Le brouillon a changé. Rechargez sa publication avant de créer la classe." };
    }
  }
  const { data, error } = await clientUtilisateur(jeton).rpc("classe_autonome_creer", {
    p_organisation: personne.organizationId,
    p_libelle: saisie.data.classe,
    p_matiere: saisie.data.matiere,
  });
  if (error) return { ok: false, message: "La classe n’a pas pu être créée. Vérifie les informations puis réessaie." };
  if (retour.success) {
    redirect(`/professeur/studio/${retour.data.document}/publication?revision=${retour.data.revision}`);
  }
  const classe = ((data ?? []) as { classe: string }[])[0]?.classe;
  redirect(classe ? `/professeur/classes?classe=${classe}` : "/professeur/classes");
}
