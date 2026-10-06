"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import type { EtatFormulaire } from "@/components/study/formulaire";
import { clientUtilisateur } from "@/lib/supabase-serveur";
import { contexteApp, idRequete } from "@/lib/v6/contexte";
import { traduire } from "@/lib/v6/erreurs";

/** Réglages — E28 : préférences enregistrées côté serveur, confirmées après acquittement. */

export async function enregistrerPreferences(_p: EtatFormulaire, donnees: FormData): Promise<EtatFormulaire> {
  const heure = (v: FormDataEntryValue | null, defaut: string) => (typeof v === "string" && /^\d{2}:\d{2}$/u.test(v) ? v : defaut);
  const preferences = {
    categories: {
      travail: donnees.get("travail") === "on",
      classe: donnees.get("classe") === "on",
      messages: donnees.get("messages") === "on",
      revisions: donnees.get("revisions") === "on",
    },
    calme_debut: heure(donnees.get("calme_debut"), "21:00"),
    calme_fin: heure(donnees.get("calme_fin"), "07:00"),
    copies_locales: donnees.get("copies_locales") === "on",
  };
  const requestId = idRequete();
  const { jeton, personne } = await contexteApp();
  const { error } = await clientUtilisateur(jeton)
    .from("preferences_notifications")
    .upsert({ profile_id: personne.profileId, ...preferences, updated_at: new Date().toISOString() }, { onConflict: "profile_id" });
  if (error !== null) return { ok: false, message: traduire(error, requestId).message, requestId };
  revalidatePath("/app/reglages");
  return { ok: true, message: "Préférences enregistrées." };
}

export async function terminerBienvenue(donnees: FormData): Promise<void> {
  const { jeton, personne } = await contexteApp();
  await clientUtilisateur(jeton)
    .from("preferences_notifications")
    .upsert({ profile_id: personne.profileId, bienvenue_faite: true, updated_at: new Date().toISOString() }, { onConflict: "profile_id" });
  revalidatePath("/app");
  const destination = String(donnees.get("vers") ?? "/app");
  redirect(destination.startsWith("/app") ? destination : "/app");
}
