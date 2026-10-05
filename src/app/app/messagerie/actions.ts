"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { clientUtilisateur } from "@/lib/supabase-serveur";
import { contexteApp, idRequete } from "@/lib/v6/contexte";
import { traduire, type CodeErreur } from "@/lib/v6/erreurs";
import { marquerLu } from "@/lib/v6/messagerie";

/**
 * Actions de messagerie — E09, §9.2.
 *
 * L'envoi n'est confirmé qu'après persistance : `salon_envoyer` rend l'id et
 * l'horodatage serveur. Un rejeu (même clientMessageId) rend le même message.
 * Le mode du salon, le débit et les mentions sont appliqués par la base.
 */

export type ResultatAction =
  | { readonly ok: true; readonly id?: string; readonly creeLe?: string; readonly valeur?: number }
  | { readonly ok: false; readonly code: CodeErreur; readonly message: string; readonly requestId: string; readonly retryAfterSeconds?: number };

const uuid = z.string().uuid();

async function rpc(fonction: string, parametres: Record<string, unknown>): Promise<{ data: unknown; erreur: ResultatAction | null }> {
  const requestId = idRequete();
  let jeton: string;
  try {
    ({ jeton } = await contexteApp());
  } catch (e) {
    // Une redirection Next (session expirée) doit remonter telle quelle.
    throw e;
  }
  const { data, error } = await clientUtilisateur(jeton).rpc(fonction, parametres);
  if (error !== null) {
    const e = traduire(error, requestId);
    return { data: null, erreur: { ok: false, code: e.code, message: e.message, requestId, retryAfterSeconds: e.retryAfterSeconds } };
  }
  return { data, erreur: null };
}

const schemaEnvoi = z.object({
  salon: uuid,
  corps: z.string().max(4000),
  clientId: uuid,
  parent: uuid.nullable(),
  kind: z.enum(["message", "question", "annonce"]),
  lecon: uuid.nullable(),
  exercice: z.string().max(120).nullable(),
  accuse: z.boolean(),
});

export async function envoyerMessage(entree: z.input<typeof schemaEnvoi>): Promise<ResultatAction> {
  const analyse = schemaEnvoi.safeParse(entree);
  if (!analyse.success || analyse.data.corps.trim().length === 0) {
    return { ok: false, code: "VALIDATION_FAILED", message: "Le message doit contenir entre 1 et 4 000 caractères.", requestId: idRequete() };
  }
  const d = analyse.data;
  const { data, erreur } = await rpc("salon_envoyer", {
    p_salon: d.salon,
    p_corps: d.corps,
    p_client_id: d.clientId,
    p_parent: d.parent,
    p_kind: d.kind,
    p_lecon: d.lecon,
    p_exercice: d.exercice,
    p_demande_accuse: d.accuse,
  });
  if (erreur) return erreur;
  const ligne = ((data ?? []) as { id: string; created_at: string }[])[0];
  if (!ligne) return { ok: false, code: "SERVER_ERROR", message: "Le message n'a pas été confirmé. Réessayez : il ne sera pas dupliqué.", requestId: idRequete() };
  return { ok: true, id: ligne.id, creeLe: ligne.created_at };
}

export async function modifierMessage(id: string, corps: string, version: number): Promise<ResultatAction> {
  if (!uuid.safeParse(id).success) return { ok: false, code: "VALIDATION_FAILED", message: "Message invalide.", requestId: idRequete() };
  const { data, erreur } = await rpc("salon_modifier", { p_message: id, p_corps: corps, p_version: version });
  return erreur ?? { ok: true, valeur: Number(data) };
}

export async function supprimerMessage(id: string): Promise<ResultatAction> {
  const { erreur } = await rpc("salon_supprimer", { p_message: id });
  return erreur ?? { ok: true };
}

export async function memeQuestion(id: string, actif: boolean): Promise<ResultatAction> {
  const { data, erreur } = await rpc("salon_meme_question", { p_message: id, p_actif: actif });
  return erreur ?? { ok: true, valeur: Number(data) };
}

export async function epingler(id: string, actif: boolean): Promise<ResultatAction> {
  const { erreur } = await rpc("salon_epingler", { p_message: id, p_epingle: actif });
  return erreur ?? { ok: true };
}

export async function masquer(id: string, actif: boolean, motif: string): Promise<ResultatAction> {
  const { erreur } = await rpc("salon_masquer", { p_message: id, p_masquer: actif, p_motif: motif.slice(0, 480) });
  return erreur ?? { ok: true };
}

export async function accuserReception(id: string): Promise<ResultatAction> {
  const { erreur } = await rpc("salon_accuser", { p_message: id });
  return erreur ?? { ok: true };
}

export async function changerMode(salon: string, mode: string, chemin: string): Promise<ResultatAction> {
  const { erreur } = await rpc("salon_changer_mode", { p_salon: salon, p_mode: mode });
  if (!erreur) revalidatePath(chemin);
  return erreur ?? { ok: true };
}

export async function lu(salon: string): Promise<void> {
  if (!uuid.safeParse(salon).success) return;
  const { jeton, personne } = await contexteApp();
  await marquerLu(jeton, personne.profileId, salon);
}

const MOTIFS = ["harcelement", "contenu_inapproprie", "hors_sujet", "autre"] as const;

/** Signaler : reçu privé ; la personne signalée ne voit pas qui a signalé. */
export async function signalerMessage(id: string, motif: string, commentaire: string): Promise<ResultatAction> {
  const requestId = idRequete();
  if (!uuid.safeParse(id).success || !MOTIFS.includes(motif as (typeof MOTIFS)[number])) {
    return { ok: false, code: "VALIDATION_FAILED", message: "Choisissez un motif.", requestId };
  }
  const { jeton, personne } = await contexteApp();
  const client = clientUtilisateur(jeton);
  const message = await client.from("messages_salon").select("organization_id").eq("id", id).maybeSingle();
  if (message.data === null) return { ok: false, code: "NOT_ACCESSIBLE", message: "Ce contenu n'est pas accessible.", requestId };
  const { error } = await client.from("reports").insert({
    organization_id: (message.data as { organization_id: string }).organization_id,
    reporter_id: personne.profileId,
    salon_message_id: id,
    reason: motif,
    detail: commentaire.trim().slice(0, 1000) || null,
  });
  if (error !== null) {
    // Déjà signalé par cette personne : ce n'est pas une erreur à afficher.
    if (error.code === "23505") return { ok: true };
    const e = traduire(error, requestId);
    return { ok: false, code: e.code, message: e.message, requestId };
  }
  return { ok: true };
}
