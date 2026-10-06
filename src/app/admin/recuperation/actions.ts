"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { EtatFormulaire } from "@/components/study/formulaire";
import { clientUtilisateur } from "@/lib/supabase-serveur";
import { contexteApp, idRequete } from "@/lib/v6/contexte";
import { traduire } from "@/lib/v6/erreurs";
import { empreinteInvitation, genererJetonInvitation } from "@/lib/v6/invitations";

/**
 * Remettre un nouvel accès après une demande de récupération.
 *
 * Vérification d'identité **avant** toute réinitialisation : la personne est
 * présente (ou connue de l'équipe) et a montré une pièce ; si la demande
 * porte une référence, celle annoncée par la personne doit correspondre —
 * contrôlé ici, côté serveur, pas seulement dans l'interface.
 *
 * Le nouvel accès est un lien d'invitation : personnel, valable trois jours,
 * à usage unique, révocable, et qui ferme les autres sessions du compte une
 * fois utilisé. Aucun mot de passe n'est créé ni transmis. Les droits
 * (`invitation_creer` exige un administrateur de l'établissement avec second
 * facteur) restent ceux de la base.
 */

const uuid = z.string().uuid();
const DUREE_JOURS = 3;

export async function remettreLien(demande: string, _p: EtatFormulaire, donnees: FormData): Promise<EtatFormulaire> {
  const requestId = idRequete();
  if (!uuid.safeParse(demande).success) return { ok: false, message: "Demande invalide.", requestId };
  if (donnees.get("identite") !== "oui") {
    return { ok: false, message: "Confirmez d'abord la vérification d'identité.", champs: { identite: ["Vérification requise avant tout nouvel accès."] }, requestId };
  }
  const annoncee = String(donnees.get("reference") ?? "").trim().toUpperCase();

  const { jeton } = await contexteApp();
  const client = clientUtilisateur(jeton);
  const { data, error } = await client.rpc("recuperation_a_traiter");
  if (error !== null) return { ok: false, message: traduire(error, requestId).message, requestId };
  const ligne = ((data ?? []) as { id: string; profile_id: string; reference: string | null }[]).find((d) => d.id === demande);
  if (!ligne) return { ok: false, message: "Cette demande n'est plus en attente.", requestId };
  if (ligne.reference !== null && annoncee !== ligne.reference) {
    return { ok: false, message: "La référence annoncée ne correspond pas à cette demande. Ne remettez pas d'accès sans comprendre pourquoi.", champs: { reference: ["Référence différente."] }, requestId };
  }

  const secret = genererJetonInvitation();
  const cree = await client.rpc("invitation_creer", { p_profile: ligne.profile_id, p_empreinte: empreinteInvitation(secret), p_jours: DUREE_JOURS });
  if (cree.error !== null) return { ok: false, message: traduire(cree.error, requestId).message, requestId };
  await client.rpc("recuperation_traiter", { p_demande: demande });
  revalidatePath("/admin/recuperation");
  const origine = (process.env.APP_ORIGIN ?? "").replace(/\/$/u, "");
  return { ok: true, message: `${origine}/invitation/${secret}` };
}

export async function marquerTraitee(donnees: FormData): Promise<void> {
  const id = uuid.safeParse(String(donnees.get("demande") ?? ""));
  if (!id.success) return;
  const { jeton } = await contexteApp();
  await clientUtilisateur(jeton).rpc("recuperation_traiter", { p_demande: id.data });
  revalidatePath("/admin/recuperation");
}
