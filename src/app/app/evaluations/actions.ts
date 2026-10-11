"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { messageEvaluation } from "@/lib/evaluations/messages";
import type { ElementSujet } from "@/lib/evaluations/sujet";
import { clientUtilisateur } from "@/lib/supabase-serveur";
import { contexteApp } from "@/lib/v6/contexte";

/**
 * Passation d'une évaluation. Chaque appel est revérifié par la base : sa
 * copie, sa fenêtre, son heure limite (une minute de grâce pour le réseau).
 * Rien ici ne décide du temps restant ni de la note.
 */

const uuid = z.string().uuid();

export type Resultat<T> = { readonly ok: true; readonly donnees: T } | { readonly ok: false; readonly message: string };

export interface CopieOuverte {
  readonly copieId: string;
  readonly sujet: readonly ElementSujet[];
  readonly limiteLe: string | null;
  readonly rendueLe: string | null;
  readonly reponses: Readonly<Record<string, Record<string, unknown>>>;
}

export async function commencer(evaluation: string): Promise<Resultat<CopieOuverte>> {
  if (!uuid.safeParse(evaluation).success) return { ok: false, message: "Évaluation inconnue." };
  const { jeton } = await contexteApp();
  const { data, error } = await clientUtilisateur(jeton).rpc("evaluation_commencer", { p_eval: evaluation });
  if (error !== null) return { ok: false, message: messageEvaluation(error) };
  const l = ((data ?? []) as { copie_id: string; sujet: ElementSujet[]; limite_le: string | null; rendue_le: string | null; reponses: Record<string, Record<string, unknown>> }[])[0];
  if (!l) return { ok: false, message: messageEvaluation(null) };
  return { ok: true, donnees: { copieId: l.copie_id, sujet: l.sujet, limiteLe: l.limite_le, rendueLe: l.rendue_le, reponses: l.reponses ?? {} } };
}

export async function repondre(copie: string, question: string, reponse: Record<string, unknown>): Promise<Resultat<string>> {
  if (!uuid.safeParse(copie).success || !uuid.safeParse(question).success) return { ok: false, message: "Réponse inconnue." };
  const { jeton } = await contexteApp();
  const { data, error } = await clientUtilisateur(jeton).rpc("evaluation_repondre", { p_copie: copie, p_question: question, p_reponse: reponse });
  if (error !== null) return { ok: false, message: messageEvaluation(error) };
  return { ok: true, donnees: String(data) };
}

export async function rendre(evaluation: string, copie: string): Promise<Resultat<string>> {
  if (!uuid.safeParse(copie).success || !uuid.safeParse(evaluation).success) return { ok: false, message: "Copie inconnue." };
  const { jeton } = await contexteApp();
  const { data, error } = await clientUtilisateur(jeton).rpc("evaluation_rendre", { p_copie: copie });
  if (error !== null) return { ok: false, message: messageEvaluation(error) };
  revalidatePath(`/app/evaluations/${evaluation}`);
  revalidatePath("/app/evaluations");
  return { ok: true, donnees: String(data) };
}

export async function signalerSortie(copie: string): Promise<void> {
  if (!uuid.safeParse(copie).success) return;
  const { jeton } = await contexteApp();
  await clientUtilisateur(jeton).rpc("evaluation_signaler_sortie", { p_copie: copie });
}
