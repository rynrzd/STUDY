import { clientUtilisateur } from "@/lib/supabase-serveur";
import { contexteApp } from "@/lib/v6/contexte";
import type { Entree } from "./vue";
import { VueCarnet } from "./vue";

export const metadata = { title: "Carnet d'erreurs" };
export const dynamic = "force-dynamic";

/**
 * A09 — Carnet d'erreurs (R2) : un repère privé, jamais un diagnostic.
 * Onglets « À retravailler / Archives », regroupement par notion ; chaque
 * entrée garde la tentative, l'explication, une catégorie et une note de
 * l'élève. Ni le professeur ni l'administration ne le lisent (RPC carnet_lire).
 */
export default async function PageCarnet({ searchParams }: { searchParams: Promise<{ archives?: string }> }) {
  const ctx = await contexteApp();
  const { archives } = await searchParams;
  const archivesVues = archives === "1";
  const { data, error } = await clientUtilisateur(ctx.jeton).rpc("carnet_lire", { p_archivees: archivesVues });
  const entrees = ((data ?? []) as Entree[]).filter((e) => (archivesVues ? true : e.archived_at === null));
  const parNotion = new Map<string, Entree[]>();
  for (const e of entrees) parNotion.set(e.notion ?? "Sans notion", [...(parNotion.get(e.notion ?? "Sans notion") ?? []), e]);

  return <VueCarnet archivesVues={archivesVues} entrees={entrees} error={error} parNotion={parNotion} />;
}
