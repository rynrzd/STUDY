import { AccesIndisponible } from "@/components/study/ui";
import { clientUtilisateur } from "@/lib/supabase-serveur";
import { contexteApp } from "@/lib/v6/contexte";
import { VueAteliersProf } from "./vue";

export const metadata = { title: "Ateliers" };
export const dynamic = "force-dynamic";

/** E38/E39 côté professeur : ses ateliers et la création d'un brouillon. */
export default async function PageAteliersProf() {
  const ctx = await contexteApp();
  if (!ctx.roles.professeur) return <AccesIndisponible />;
  const client = clientUtilisateur(ctx.jeton);
  const [ateliers, cours] = await Promise.all([
    client.from("ateliers").select("id, kind, titre, etat, created_by").eq("created_by", ctx.personne.profileId).order("created_at", { ascending: false }),
    client.rpc("mes_cours"),
  ]);
  const espaces = ((cours.data ?? []) as { id: string; matiere: string; classe: string | null; enseigne: boolean }[])
    .filter((c) => c.enseigne)
    .map((c) => ({ id: c.id, libelle: `${c.matiere}${c.classe ? ` — ${c.classe}` : ""}` }));
  const liste = (ateliers.data ?? []) as { id: string; kind: string; titre: string; etat: string }[];
  return <VueAteliersProf liste={liste} espaces={espaces} />;
}
