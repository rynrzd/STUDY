"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { clientUtilisateur } from "@/lib/supabase-serveur";
import { contexteApp } from "@/lib/v6/contexte";
import { suiteSure } from "@/lib/v6/redirection";

/** Marquer lu (idempotent) puis aller à l'objet — lien interne revalidé. */
export async function ouvrirNotification(donnees: FormData): Promise<void> {
  const id = z.string().uuid().safeParse(String(donnees.get("notification") ?? ""));
  const { jeton } = await contexteApp();
  if (id.success) await clientUtilisateur(jeton).rpc("notification_lue", { p_notification: id.data });
  revalidatePath("/app", "layout");
  redirect(suiteSure(String(donnees.get("lien") ?? "")) ?? "/app/notifications");
}

export async function toutLu(): Promise<void> {
  const { jeton } = await contexteApp();
  await clientUtilisateur(jeton).from("nouveautes").update({ lu_le: new Date().toISOString() }).is("lu_le", null);
  revalidatePath("/app", "layout");
}
