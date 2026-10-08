import { clientUtilisateur } from "@/lib/supabase-serveur";
import { contexteApp } from "@/lib/v6/contexte";
import { nomsAffichables } from "@/lib/v6/classe";
import { VueDemandes } from "./vue";

export const metadata = { title: "Demandes personnelles" };
export const dynamic = "force-dynamic";

export default async function PageDemandes() {
  const ctx = await contexteApp();
  const { data } = await clientUtilisateur(ctx.jeton)
    .from("demandes_adulte")
    .select("id, subject, state, created_at, author_id, recipient_id")
    .order("created_at", { ascending: false })
    .limit(50);
  const lignes = (data ?? []) as { id: string; subject: string; state: string; created_at: string; author_id: string; recipient_id: string }[];
  const noms = await nomsAffichables(ctx.jeton, lignes.flatMap((l) => [l.author_id, l.recipient_id]));
  const moi = ctx.personne.profileId;
  const eleve = ctx.roles.eleve;
  return <VueDemandes lignes={lignes} noms={noms} moi={moi} eleve={eleve} />;
}
