"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { extraitDuTexte } from "@/lib/document-cours";
import { clientUtilisateur } from "@/lib/supabase-serveur";
import { paragraphesDeLaSeance, seanceDetail } from "@/lib/v6/cours";
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

export interface EtatIncompris {
  readonly ok: boolean;
  readonly message: string;
}

/**
 * « Je n'ai pas compris ce passage » (0062). Privé : le professeur ne verra
 * qu'un nombre d'élèves par passage, jamais de nom. La fonction revérifie que
 * la séance est publiée et lisible par la personne ; l'extrait doit venir du
 * cours (`extraitDuTexte`).
 */
export async function marquerIncompris(seance: string, extrait: string): Promise<EtatIncompris> {
  const requestId = idRequete();
  const texte = extrait.replace(/\s+/g, " ").trim().slice(0, 500);
  if (!uuid.safeParse(seance).success || texte.length < 3) return { ok: false, message: "Sélectionne au moins quelques mots du cours." };
  const { jeton } = await contexteApp();
  const s = await seanceDetail(jeton, seance);
  if (s === null || s.etat !== "publiee") return { ok: false, message: "Cette séance n'est pas accessible." };
  if (!extraitDuTexte(texte, paragraphesDeLaSeance(s))) return { ok: false, message: "Sélectionne un passage du cours lui-même." };
  const { error } = await clientUtilisateur(jeton).rpc("passage_incompris_marquer", { p_lecon: seance, p_extrait: texte });
  if (error !== null) {
    if (/TROP_DE_PASSAGES/.test(error.message)) return { ok: false, message: "Tu as déjà signalé 30 passages sur cette séance." };
    return { ok: false, message: traduire(error, requestId).message };
  }
  revalidatePath(`/app/seances/${seance}`);
  return { ok: true, message: "Passage signalé. Ton professeur verra qu'il pose problème, sans ton nom." };
}

/** « C'est compris » : retire le passage de ses signalements (et des nombres du professeur). */
export async function marquerCompris(donnees: FormData): Promise<void> {
  const passage = String(donnees.get("passage") ?? "");
  const seance = String(donnees.get("seance") ?? "");
  if (!uuid.safeParse(passage).success || !uuid.safeParse(seance).success) return;
  const { jeton } = await contexteApp();
  await clientUtilisateur(jeton).rpc("passage_incompris_compris", { p_passage: passage });
  revalidatePath(`/app/seances/${seance}`);
}
