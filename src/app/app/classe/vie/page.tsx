import { redirect } from "next/navigation";
import { contexteApp } from "@/lib/v6/contexte";

export const dynamic = "force-dynamic";

/** Route du catalogue V7 : renvoie vers la classe active (adhésion vérifiée par contexteApp). */
export default async function Page() {
  const ctx = await contexteApp();
  if (!ctx.classeActive) redirect("/app/classe");
  redirect(`/app/classes/${ctx.classeActive.classe}/propositions`);
}
