"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { EtatFormulaire } from "@/components/study/formulaire";
import { clientUtilisateur } from "@/lib/supabase-serveur";
import { contexteApp, idRequete } from "@/lib/v6/contexte";
import { traduire } from "@/lib/v6/erreurs";

/** Passage d'année (D05) : les contrôles réels sont en base (0059). */

const schema = z.object({
  label: z.string().trim().regex(/^\d{4}-\d{4}$/u, "Format attendu : 2027-2028."),
  debut: z.string().date("Date de rentrée invalide."),
  fin: z.string().date("Date de fin invalide."),
});

export async function preparerAnnee(_p: EtatFormulaire, donnees: FormData): Promise<EtatFormulaire> {
  const valeurs = { label: String(donnees.get("label") ?? ""), debut: String(donnees.get("debut") ?? ""), fin: String(donnees.get("fin") ?? "") };
  const analyse = schema.safeParse(valeurs);
  if (!analyse.success) {
    const champs: Record<string, string[]> = {};
    for (const i of analyse.error.issues) champs[String(i.path[0])] = [i.message];
    return { ok: false, message: "Vérifiez les champs signalés.", champs, valeurs };
  }
  if (analyse.data.fin <= analyse.data.debut) return { ok: false, message: "La fin doit suivre la rentrée.", champs: { fin: ["Date antérieure à la rentrée."] }, valeurs };
  const requestId = idRequete();
  const { jeton } = await contexteApp();
  const { error } = await clientUtilisateur(jeton).rpc("annee_preparer", { p_label: analyse.data.label, p_debut: analyse.data.debut, p_fin: analyse.data.fin });
  if (error !== null) return { ok: false, message: traduire(error, requestId).message, requestId, valeurs };
  revalidatePath("/admin/annees");
  return { ok: true, message: `Année ${analyse.data.label} préparée. Importez ses classes avec l'assistant de rentrée, puis basculez.` };
}

export async function basculerAnnee(donnees: FormData): Promise<void> {
  const id = z.string().uuid().safeParse(String(donnees.get("annee") ?? ""));
  if (!id.success) return;
  const { jeton } = await contexteApp();
  await clientUtilisateur(jeton).rpc("annee_basculer", { p_cible: id.data });
  revalidatePath("/admin/annees");
}
