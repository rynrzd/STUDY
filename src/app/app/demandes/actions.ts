"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { EtatFormulaire } from "@/components/study/formulaire";
import { clientUtilisateur } from "@/lib/supabase-serveur";
import { contexteApp, idRequete } from "@/lib/v6/contexte";
import { traduire } from "@/lib/v6/erreurs";

/**
 * Demandes personnelles à un adulte — dossier V6, §8.4 et §9. Circuit
 * distinct du salon : l'auteur et le destinataire désigné, personne d'autre.
 * L'identifiant client rend l'envoi idempotent (double clic, réseau).
 */

const uuid = z.string().uuid();

export async function ouvrirDemande(_p: EtatFormulaire, donnees: FormData): Promise<EtatFormulaire> {
  const valeurs = {
    destinataire: String(donnees.get("destinataire") ?? ""),
    sujet: String(donnees.get("sujet") ?? "").trim(),
    corps: String(donnees.get("corps") ?? "").trim(),
    client: String(donnees.get("client") ?? ""),
    lecon: String(donnees.get("lecon") ?? ""),
  };
  const champs: Record<string, string[]> = {};
  if (!uuid.safeParse(valeurs.destinataire).success) champs.destinataire = ["Choisissez à qui écrire."];
  if (valeurs.sujet.length < 3) champs.sujet = ["Trois caractères au moins."];
  if (valeurs.corps.length < 1) champs.corps = ["Écrivez votre message."];
  if (Object.keys(champs).length > 0) return { ok: false, message: "Certains champs sont à corriger.", champs, valeurs };

  const requestId = idRequete();
  const { jeton } = await contexteApp();
  const { data, error } = await clientUtilisateur(jeton).rpc("demande_ouvrir", {
    p_destinataire: valeurs.destinataire,
    p_sujet: valeurs.sujet.slice(0, 140),
    p_corps: valeurs.corps.slice(0, 4000),
    p_client_id: uuid.safeParse(valeurs.client).success ? valeurs.client : randomUUID(),
    p_lecon: uuid.safeParse(valeurs.lecon).success ? valeurs.lecon : null,
  });
  if (error !== null) {
    const e = traduire(error, requestId);
    return { ok: false, message: e.message, requestId, valeurs };
  }
  redirect(`/app/demandes/${String(data)}?envoyee=1`);
}

export async function repondreDemande(demande: string, _p: EtatFormulaire, donnees: FormData): Promise<EtatFormulaire> {
  const corps = String(donnees.get("corps") ?? "").trim();
  const client = String(donnees.get("client") ?? "");
  if (!corps) return { ok: false, message: "Écrivez votre message.", champs: { corps: ["Message vide."] } };
  const requestId = idRequete();
  const { jeton } = await contexteApp();
  const { error } = await clientUtilisateur(jeton).rpc("demande_repondre", {
    p_demande: demande,
    p_corps: corps.slice(0, 4000),
    p_client_id: uuid.safeParse(client).success ? client : randomUUID(),
  });
  if (error !== null) {
    const e = traduire(error, requestId);
    // On garde le même identifiant : réessayer ne dupliquera pas le message.
    return { ok: false, message: e.message, requestId, valeurs: { corps, client } };
  }
  revalidatePath(`/app/demandes/${demande}`);
  return { ok: true, message: "Message envoyé.", valeurs: { client: randomUUID() } };
}

export async function clore(donnees: FormData): Promise<void> {
  const demande = uuid.safeParse(String(donnees.get("demande") ?? ""));
  if (!demande.success) return;
  const { jeton } = await contexteApp();
  await clientUtilisateur(jeton).rpc("demande_clore", { p_demande: demande.data });
  revalidatePath(`/app/demandes/${demande.data}`);
}
