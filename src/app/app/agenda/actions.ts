"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { EtatFormulaire } from "@/components/study/formulaire";
import { clientUtilisateur } from "@/lib/supabase-serveur";
import { contexteApp, idRequete } from "@/lib/v6/contexte";
import { traduire } from "@/lib/v6/erreurs";

/**
 * Agenda — E16. Un élève ajoute ses créneaux personnels ; l'équipe
 * pédagogique ajoute contrôles et événements de classe (vérifié par RLS).
 * On ne modifie que ses propres événements.
 */

const KINDS = ["creneau", "revision", "controle", "cours", "vie_de_classe"] as const;

export async function ajouterEvenement(_p: EtatFormulaire, donnees: FormData): Promise<EtatFormulaire> {
  const valeurs = {
    titre: String(donnees.get("titre") ?? "").trim(),
    debut: String(donnees.get("debut") ?? ""),
    fin: String(donnees.get("fin") ?? ""),
    kind: String(donnees.get("kind") ?? "creneau"),
    cible: String(donnees.get("cible") ?? "moi"),
  };
  const champs: Record<string, string[]> = {};
  if (valeurs.titre.length < 2) champs.titre = ["Deux caractères au moins."];
  const debut = new Date(valeurs.debut);
  if (Number.isNaN(debut.getTime())) champs.debut = ["Date et heure requises."];
  const fin = valeurs.fin ? new Date(valeurs.fin) : null;
  if (fin && (Number.isNaN(fin.getTime()) || fin <= debut)) champs.fin = ["La fin doit suivre le début."];
  if (!(KINDS as readonly string[]).includes(valeurs.kind)) champs.kind = ["Type inconnu."];
  if (Object.keys(champs).length > 0) return { ok: false, message: "Certains champs sont à corriger.", champs, valeurs };

  const requestId = idRequete();
  const { jeton, personne } = await contexteApp();
  const client = clientUtilisateur(jeton);
  let organisation: string | null = personne.organizationId;
  let ligne: Record<string, unknown> = { owner_id: personne.profileId };
  if (valeurs.cible.startsWith("espace:") || valeurs.cible.startsWith("classe:")) {
    const [type, id] = valeurs.cible.split(":");
    if (!z.string().uuid().safeParse(id).success) return { ok: false, message: "Cible invalide.", valeurs };
    const table = type === "espace" ? "teaching_spaces" : "classes";
    const lue = await client.from(table).select("organization_id").eq("id", id!).maybeSingle();
    if (lue.data === null) return { ok: false, message: "Ce contenu n'est pas accessible.", requestId, valeurs };
    organisation = (lue.data as { organization_id: string }).organization_id;
    ligne = type === "espace" ? { teaching_space_id: id } : { class_id: id };
  }
  if (organisation === null) return { ok: false, message: "Aucun établissement actif.", requestId, valeurs };
  const { error } = await client.from("agenda_evenements").insert({
    organization_id: organisation,
    ...ligne,
    kind: valeurs.cible === "moi" ? (valeurs.kind === "controle" ? "creneau" : valeurs.kind) : valeurs.kind,
    titre: valeurs.titre.slice(0, 140),
    debut: debut.toISOString(),
    fin: fin ? fin.toISOString() : null,
    created_by: personne.profileId,
  });
  if (error !== null) {
    const e = traduire(error, requestId);
    return { ok: false, message: error.code === "42501" ? "Vous ne pouvez ajouter que vos créneaux personnels." : e.message, requestId, valeurs };
  }
  revalidatePath("/app/agenda");
  revalidatePath("/app");
  return { ok: true, message: "Ajouté à l'agenda." };
}

export async function supprimerEvenement(donnees: FormData): Promise<void> {
  const id = z.string().uuid().safeParse(String(donnees.get("evenement") ?? ""));
  if (!id.success) return;
  const { jeton } = await contexteApp();
  await clientUtilisateur(jeton).from("agenda_evenements").delete().eq("id", id.data);
  revalidatePath("/app/agenda");
}
