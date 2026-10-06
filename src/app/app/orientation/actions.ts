"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { EtatFormulaire } from "@/components/study/formulaire";
import { clientUtilisateur } from "@/lib/supabase-serveur";
import { contexteApp, idRequete } from "@/lib/v6/contexte";
import { traduire } from "@/lib/v6/erreurs";

/** Orientation et stages — E26. Espace privé ; partage objet par objet ; aucun envoi automatique. */

const STATUTS = ["a_explorer", "a_contacter", "contacte", "reponse", "clos"] as const;

export async function ajouterPiste(_p: EtatFormulaire, donnees: FormData): Promise<EtatFormulaire> {
  const valeurs = {
    kind: ["intention", "piste", "stage"].includes(String(donnees.get("kind"))) ? String(donnees.get("kind")) : "piste",
    intitule: String(donnees.get("intitule") ?? "").trim(),
    organisation: String(donnees.get("organisation") ?? "").trim(),
    echeance: String(donnees.get("echeance") ?? ""),
  };
  if (valeurs.intitule.length < 2) return { ok: false, message: "Décris ta piste.", champs: { intitule: ["Deux caractères au moins."] }, valeurs };
  const requestId = idRequete();
  const { jeton, personne } = await contexteApp();
  if (!personne.organizationId) return { ok: false, message: "Aucun établissement actif.", requestId, valeurs };
  const { error } = await clientUtilisateur(jeton).from("orientation_pistes").insert({
    organization_id: personne.organizationId,
    owner_id: personne.profileId,
    kind: valeurs.kind,
    intitule: valeurs.intitule.slice(0, 160),
    organisation: valeurs.organisation.slice(0, 160) || null,
    echeance: /^\d{4}-\d{2}-\d{2}$/u.test(valeurs.echeance) ? valeurs.echeance : null,
  });
  if (error !== null) return { ok: false, message: traduire(error, requestId).message, requestId, valeurs };
  revalidatePath("/app/orientation");
  return { ok: true, message: "Ajouté à ton espace d'orientation." };
}

export async function modifierPiste(piste: string, version: number, _p: EtatFormulaire, donnees: FormData): Promise<EtatFormulaire> {
  const statut = String(donnees.get("statut") ?? "a_explorer");
  const valeurs = {
    intitule: String(donnees.get("intitule") ?? "").trim(),
    organisation: String(donnees.get("organisation") ?? "").trim(),
    statut,
    contact: String(donnees.get("contact") ?? "").trim(),
    echeance: String(donnees.get("echeance") ?? ""),
    notes: String(donnees.get("notes") ?? ""),
  };
  if (valeurs.intitule.length < 2) return { ok: false, message: "Intitulé requis.", champs: { intitule: ["Deux caractères au moins."] }, valeurs };
  const requestId = idRequete();
  const { jeton } = await contexteApp();
  const { data, error } = await clientUtilisateur(jeton).rpc("orientation_modifier", {
    p_piste: piste,
    p_version: version,
    p_intitule: valeurs.intitule.slice(0, 160),
    p_organisation: valeurs.organisation.slice(0, 160),
    p_statut: (STATUTS as readonly string[]).includes(statut) ? statut : "a_explorer",
    p_contact: valeurs.contact.slice(0, 200),
    p_echeance: /^\d{4}-\d{2}-\d{2}$/u.test(valeurs.echeance) ? valeurs.echeance : null,
    p_notes: valeurs.notes.slice(0, 8000),
  });
  if (error !== null) {
    const e = traduire(error, requestId);
    return { ok: false, message: e.message, code: e.code, requestId, valeurs };
  }
  revalidatePath("/app/orientation");
  return { ok: true, message: "Enregistré.", valeurs: { ...valeurs, version: String(data) } };
}

export async function partagerPiste(donnees: FormData): Promise<void> {
  const piste = z.string().uuid().safeParse(String(donnees.get("piste") ?? ""));
  const destinataire = z.string().uuid().safeParse(String(donnees.get("destinataire") ?? ""));
  if (!piste.success || !destinataire.success) return;
  const { jeton } = await contexteApp();
  await clientUtilisateur(jeton).rpc("orientation_partager", { p_piste: piste.data, p_destinataire: destinataire.data });
  revalidatePath("/app/orientation");
}

export async function supprimerPiste(donnees: FormData): Promise<void> {
  const piste = z.string().uuid().safeParse(String(donnees.get("piste") ?? ""));
  if (!piste.success) return;
  const { jeton } = await contexteApp();
  await clientUtilisateur(jeton).from("orientation_pistes").delete().eq("id", piste.data);
  revalidatePath("/app/orientation");
}
