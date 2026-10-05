import { redirect } from "next/navigation";
import { EtatVide } from "@/components/study/ui";
import { contexteApp } from "@/lib/v6/contexte";
import { mesSalons } from "@/lib/v6/messagerie";

export const metadata = { title: "Messagerie de la classe" };
export const dynamic = "force-dynamic";

/** L'onglet Messagerie d'une classe ouvre son salon général. */
export default async function PageSalonsClasse({ params }: { params: Promise<{ classe: string }> }) {
  const ctx = await contexteApp();
  const { classe } = await params;
  const salons = (await mesSalons(ctx.jeton)) ?? [];
  const general = salons.find((s) => s.classId === classe && s.kind === "general") ?? salons.find((s) => s.classId === classe);
  if (general) redirect(`/app/classes/${classe}/salons/${general.id}`);
  return <EtatVide titre="Aucun salon accessible" texte="Les salons de cette classe ne sont pas accessibles depuis ton compte." />;
}
