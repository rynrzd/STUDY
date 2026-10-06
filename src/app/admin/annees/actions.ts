"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { EtatFormulaire } from "@/components/study/formulaire";
import { clientUtilisateur } from "@/lib/supabase-serveur";
import { contexteApp, idRequete } from "@/lib/v6/contexte";
import { traduire } from "@/lib/v6/erreurs";

/**
 * Passage d'année (D05). Les contrôles réels sont en base (0059) :
 * administration de l'établissement avec second facteur, idempotence, refus
 * d'une année sans classe, refus tant que des élèves actifs n'ont pas de
 * classe dans l'année cible (sauf confirmation explicite, journalisée).
 */

const uuid = z.string().uuid();
const schema = z.object({
  label: z.string().trim().regex(/^\d{4}-\d{4}$/u, "Format attendu : 2027-2028."),
  debut: z.string().date("Date de rentrée invalide."),
  fin: z.string().date("Date de fin invalide."),
});

async function rpc(fonction: string, parametres: Record<string, unknown>) {
  const requestId = idRequete();
  const { jeton } = await contexteApp();
  const { data, error } = await clientUtilisateur(jeton).rpc(fonction, parametres);
  return { data, erreur: error === null ? null : traduire(error, requestId) };
}

export async function preparerAnnee(_p: EtatFormulaire, donnees: FormData): Promise<EtatFormulaire> {
  const valeurs = { label: String(donnees.get("label") ?? ""), debut: String(donnees.get("debut") ?? ""), fin: String(donnees.get("fin") ?? "") };
  const analyse = schema.safeParse(valeurs);
  if (!analyse.success) {
    const champs: Record<string, string[]> = {};
    for (const i of analyse.error.issues) champs[String(i.path[0])] = [i.message];
    return { ok: false, message: "Vérifiez les champs signalés.", champs, valeurs };
  }
  if (analyse.data.fin <= analyse.data.debut) return { ok: false, message: "La fin doit suivre la rentrée.", champs: { fin: ["Date antérieure à la rentrée."] }, valeurs };
  const { erreur } = await rpc("annee_preparer", { p_label: analyse.data.label, p_debut: analyse.data.debut, p_fin: analyse.data.fin });
  if (erreur) return { ok: false, message: erreur.message, requestId: erreur.requestId, valeurs };
  revalidatePath("/admin/annees");
  return { ok: true, message: `Année ${analyse.data.label} préparée. Créez ou importez ses classes, puis reconduisez les élèves.` };
}

export async function creerClasseCible(annee: string, _p: EtatFormulaire, donnees: FormData): Promise<EtatFormulaire> {
  const libelle = String(donnees.get("libelle") ?? "").trim();
  if (!uuid.safeParse(annee).success) return { ok: false, message: "Année invalide." };
  if (libelle.length < 2 || libelle.length > 60) return { ok: false, message: "Indiquez le nom de la classe.", champs: { libelle: ["2 à 60 caractères."] } };
  const { erreur } = await rpc("annee_creer_classe", { p_annee: annee, p_libelle: libelle });
  if (erreur) return { ok: false, message: erreur.message, requestId: erreur.requestId, valeurs: { libelle } };
  revalidatePath("/admin/annees");
  return { ok: true, message: `Classe « ${libelle} » créée.` };
}

export async function preinscrire(_p: EtatFormulaire, donnees: FormData): Promise<EtatFormulaire> {
  const source = uuid.safeParse(String(donnees.get("source") ?? ""));
  const cible = uuid.safeParse(String(donnees.get("cible") ?? ""));
  if (!source.success || !cible.success) return { ok: false, message: "Choisissez la classe d'arrivée.", champs: { cible: ["Choix requis."] } };
  const { data, erreur } = await rpc("annee_preinscrire_classe", { p_classe_source: source.data, p_classe_cible: cible.data });
  if (erreur) return { ok: false, message: erreur.message, requestId: erreur.requestId };
  revalidatePath("/admin/annees");
  const n = Number(data ?? 0);
  return { ok: true, message: n === 0 ? "Aucun élève à ajouter : ils sont déjà inscrits dans l'année suivante." : `${n} élève${n > 1 ? "s" : ""} préinscrit${n > 1 ? "s" : ""}.` };
}

export async function basculer(annee: string, _p: EtatFormulaire, donnees: FormData): Promise<EtatFormulaire> {
  if (!uuid.safeParse(annee).success) return { ok: false, message: "Année invalide." };
  const confirmer = donnees.get("confirmerSansClasse") === "oui";
  const { data, erreur } = await rpc("annee_basculer", { p_cible: annee, p_confirmer_sans_classe: confirmer });
  if (erreur) return { ok: false, message: erreur.message, requestId: erreur.requestId };
  revalidatePath("/admin/annees");
  return { ok: true, message: data === true ? "Bascule effectuée. L'année quittée est archivée ; rien n'a été supprimé." : "Cette année était déjà la courante : rien n'a été modifié." };
}
