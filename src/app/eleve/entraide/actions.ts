"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { jetonAccesDe, sessionCourante } from "@/lib/session-serveur";
import { clientUtilisateur } from "@/lib/supabase-serveur";

/**
 * Groupes d'entraide — cahier V2, §13.
 *
 * Comme le Studio, tout agit avec le jeton de la personne. Rejoindre un groupe
 * d'une autre classe ne renvoie pas « interdit » : l'écriture ne touche rien,
 * parce que RLS ne voit pas la ligne. L'autorisation n'est donc pas une
 * vérification écrite ici, qu'on pourrait oublier demain.
 *
 * La taille d'un groupe est tenue par un déclencheur en base. C'est
 * indispensable : deux élèves qui cliquent « rejoindre » dans la même seconde
 * sur la dernière place libre passeraient tous les deux une vérification faite
 * en JavaScript.
 */

import type { EtatEntraide } from "./etats";

const REFUS: EtatEntraide = {
  etat: "erreur",
  message: "Cette action n'a pas pu être effectuée.",
};

async function eleveConnecte(): Promise<{ jeton: string; profileId: string } | null> {
  const personne = await sessionCourante();
  if (personne === null || personne.activationRequise) return null;
  if (!personne.roles.includes("eleve") && !personne.roles.includes("professeur")) return null;

  const jeton = await jetonAccesDe(personne);
  return jeton === null ? null : { jeton, profileId: personne.profileId };
}

export async function creerGroupe(
  _precedent: EtatEntraide,
  donnees: FormData,
): Promise<EtatEntraide> {
  const session = await eleveConnecte();
  if (session === null) return REFUS;

  const analyse = z
    .object({
      cours: z.string().uuid(),
      label: z.string().trim().min(2).max(80),
      taille: z.coerce.number().int().min(2).max(6),
    })
    .safeParse({
      cours: donnees.get("cours"),
      label: donnees.get("label"),
      taille: donnees.get("taille") ?? 4,
    });

  if (!analyse.success) {
    return { etat: "erreur", message: "Donnez un nom au groupe, entre 2 et 80 caractères." };
  }

  const client = clientUtilisateur(session.jeton);

  // Le cours est relu sous RLS : il donne l'établissement, et son absence dit
  // que la personne n'y assiste pas.
  const { data: cours } = await client
    .from("teaching_spaces")
    .select("organization_id")
    .eq("id", analyse.data.cours)
    .maybeSingle();

  const contexte = cours as { organization_id: string } | null;
  if (contexte === null) return REFUS;

  const { data: groupe, error } = await client
    .from("workgroups")
    .insert({
      organization_id: contexte.organization_id,
      teaching_space_id: analyse.data.cours,
      label: analyse.data.label,
      max_members: analyse.data.taille,
      created_by: session.profileId,
    })
    .select("id")
    .single();

  if (error !== null || groupe === null) return REFUS;

  // Celui qui ouvre le groupe en fait partie : un groupe vide créé par erreur
  // encombrerait la liste de tout le monde.
  const { error: erreurMembre } = await client.from("workgroup_members").insert({
    organization_id: contexte.organization_id,
    workgroup_id: (groupe as { id: string }).id,
    profile_id: session.profileId,
  });

  if (erreurMembre !== null) {
    await client.from("workgroups").delete().eq("id", (groupe as { id: string }).id);
    return REFUS;
  }

  revalidatePath("/eleve/entraide");
  return { etat: "ok", message: `Groupe « ${analyse.data.label} » créé.` };
}

export async function rejoindreGroupe(
  _precedent: EtatEntraide,
  donnees: FormData,
): Promise<EtatEntraide> {
  const session = await eleveConnecte();
  if (session === null) return REFUS;

  const analyse = z.object({ groupe: z.string().uuid() }).safeParse({
    groupe: donnees.get("groupe"),
  });
  if (!analyse.success) return REFUS;

  const client = clientUtilisateur(session.jeton);

  const { data: groupe } = await client
    .from("workgroups")
    .select("organization_id, closed_at")
    .eq("id", analyse.data.groupe)
    .maybeSingle();

  const contexte = groupe as { organization_id: string; closed_at: string | null } | null;
  if (contexte === null) return REFUS;
  if (contexte.closed_at !== null) {
    return { etat: "erreur", message: "Ce groupe est fermé." };
  }

  // Une personne partie puis revenue : on réactive sa ligne plutôt que d'en
  // créer une seconde, que l'index d'unicité refuserait de toute façon.
  const { data: ancienne } = await client
    .from("workgroup_members")
    .select("id")
    .eq("workgroup_id", analyse.data.groupe)
    .eq("profile_id", session.profileId)
    .maybeSingle();

  const { error } =
    ancienne === null
      ? await client.from("workgroup_members").insert({
          organization_id: contexte.organization_id,
          workgroup_id: analyse.data.groupe,
          profile_id: session.profileId,
        })
      : await client
          .from("workgroup_members")
          .update({ left_at: null })
          .eq("id", (ancienne as { id: string }).id);

  if (error !== null) {
    // `23514` : le déclencheur de capacité. C'est le seul refus qu'on explique,
    // parce que c'est le seul que la personne peut comprendre et contourner —
    // en choisissant un autre groupe.
    return error.code === "23514"
      ? { etat: "erreur", message: "Ce groupe est complet. Choisissez-en un autre." }
      : REFUS;
  }

  revalidatePath("/eleve/entraide");
  return { etat: "ok", message: "Vous faites partie du groupe." };
}

export async function quitterGroupe(
  _precedent: EtatEntraide,
  donnees: FormData,
): Promise<EtatEntraide> {
  const session = await eleveConnecte();
  if (session === null) return REFUS;

  const analyse = z.object({ groupe: z.string().uuid() }).safeParse({
    groupe: donnees.get("groupe"),
  });
  if (!analyse.success) return REFUS;

  // La ligne est datée, pas supprimée : l'historique du groupe reste lisible,
  // et c'est cette date qui fermera plus tard les canaux temps réel (ch. 17).
  const { error } = await clientUtilisateur(session.jeton)
    .from("workgroup_members")
    .update({ left_at: new Date().toISOString() })
    .eq("workgroup_id", analyse.data.groupe)
    .eq("profile_id", session.profileId)
    .is("left_at", null);

  if (error !== null) return REFUS;

  revalidatePath("/eleve/entraide");
  return { etat: "ok", message: "Vous avez quitté le groupe." };
}
