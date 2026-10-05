"use server";

import { cookies } from "next/headers";
import { redirect } from "next/navigation";
import { COOKIE_CLASSE, contexteApp } from "@/lib/v6/contexte";
import { suiteSure } from "@/lib/v6/redirection";

/**
 * Changer de classe active — dossier Study V6, §2.1.
 *
 * Seule une classe des affectations vérifiées est retenue : une valeur
 * forgée est ignorée. Le cookie n'est qu'une préférence d'affichage ; chaque
 * lecture repasse par RLS, quel que soit son contenu.
 */
export async function changerClasse(donnees: FormData): Promise<void> {
  const { contextes } = await contexteApp();
  const demandee = String(donnees.get("classe") ?? "");
  const retenue = contextes.find((c) => c.classe === demandee);
  if (retenue !== undefined) {
    (await cookies()).set(COOKIE_CLASSE, retenue.classe, {
      httpOnly: true,
      secure: process.env.NODE_ENV === "production",
      sameSite: "lax",
      path: "/",
      maxAge: 60 * 60 * 24 * 180,
    });
  }
  redirect(suiteSure(String(donnees.get("retour") ?? "")) ?? "/app");
}
