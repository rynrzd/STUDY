"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { clientUtilisateur } from "@/lib/supabase-serveur";
import { contexteApp, idRequete } from "@/lib/v6/contexte";
import { traduire } from "@/lib/v6/erreurs";

/**
 * Actions d'une séance — E03. L'identité vient de la session ; chaque
 * mutation repasse par RLS ou par une fonction qui revérifie les droits.
 */

const uuid = z.string().uuid();

export interface EtatNote {
  readonly etat: "inchange" | "enregistre" | "conflit" | "erreur";
  readonly revision: number;
  readonly message?: string;
  readonly enregistreLe?: string;
}

/** Enregistre la note privée sous la révision lue ; un autre onglet plus récent donne un conflit. */
export async function enregistrerNote(seance: string, corps: string, revisionLue: number): Promise<EtatNote> {
  const requestId = idRequete();
  if (!uuid.safeParse(seance).success || corps.length > 20_000) {
    return { etat: "erreur", revision: revisionLue, message: "Note trop longue (20 000 caractères au plus)." };
  }
  const { jeton } = await contexteApp();
  const { data, error } = await clientUtilisateur(jeton).rpc("note_enregistrer", {
    p_lecon: seance,
    p_corps: corps,
    p_revision: revisionLue,
  });
  if (error !== null) {
    const e = traduire(error, requestId);
    return { etat: e.code === "VERSION_CONFLICT" ? "conflit" : "erreur", revision: revisionLue, message: e.message };
  }
  return { etat: "enregistre", revision: Number(data), enregistreLe: new Date().toISOString() };
}

/** La dernière lecture, pour « Reprendre ». Jamais en GET : c'est une écriture. */
export async function noterLecture(seance: string): Promise<void> {
  if (!uuid.safeParse(seance).success) return;
  const { jeton, personne } = await contexteApp();
  await clientUtilisateur(jeton)
    .from("lectures_seance")
    .upsert({ owner_id: personne.profileId, lesson_id: seance, lu_le: new Date().toISOString() }, { onConflict: "owner_id,lesson_id" });
}

/** Marquer à revoir, ou relu (rattrapage), à titre personnel. */
export async function basculerRepere(donnees: FormData): Promise<void> {
  const seance = String(donnees.get("seance") ?? "");
  const kind = String(donnees.get("kind") ?? "");
  const actif = donnees.get("actif") === "oui";
  if (!uuid.safeParse(seance).success || !["a_revoir", "relu"].includes(kind)) return;
  const { jeton, personne } = await contexteApp();
  const client = clientUtilisateur(jeton);
  if (actif) {
    await client.from("reperes_seance").insert({ owner_id: personne.profileId, lesson_id: seance, kind });
  } else {
    await client.from("reperes_seance").delete().eq("lesson_id", seance).eq("kind", kind).is("block_id", null);
  }
  revalidatePath(`/app/seances/${seance}`);
  revalidatePath("/app/rattrapage");
}

/** Ouvrir une session d'entraînement sur des exercices lisibles (vérifiés côté base). */
export async function sEntrainer(donnees: FormData): Promise<void> {
  const versions = donnees.getAll("version").map(String).filter((v) => uuid.safeParse(v).success).slice(0, 40);
  const titre = String(donnees.get("titre") ?? "Entraînement").slice(0, 140);
  if (versions.length === 0) redirect("/app/reviser?erreur=aucun-exercice");
  const { jeton } = await contexteApp();
  const { data, error } = await clientUtilisateur(jeton).rpc("entrainement_ouvrir", {
    p_titre: titre,
    p_versions: versions,
    p_fiche: null,
  });
  if (error !== null) redirect("/app/reviser?erreur=entrainement");
  redirect(`/app/entrainements/${String(data)}`);
}
