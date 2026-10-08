import { clientUtilisateur } from "@/lib/supabase-serveur";
import { contexteApp } from "@/lib/v6/contexte";
import { nomsAffichables } from "@/lib/v6/classe";
import { FILTRES, type Piste } from "./vue";
import { VueOrientation } from "./vue";

export const metadata = { title: "Orientation et stages" };
export const dynamic = "force-dynamic";

/**
 * E26 — Orientation et stages : un espace privé. Partager se fait piste par
 * piste, avec un adulte qui t'encadre ; aucune candidature n'est envoyée,
 * aucun profil n'est découvrable.
 */
export default async function PageOrientation({ searchParams }: { searchParams: Promise<{ type?: string }> }) {
  const ctx = await contexteApp();
  const { type } = await searchParams;
  const filtre = FILTRES.find((f) => f.cle === type)?.cle ?? "toutes";
  const garde = (kind: string) => filtre === "toutes" || (filtre === "piste" ? kind !== "intention" && kind !== "stage" : kind === filtre);
  const client = clientUtilisateur(ctx.jeton);
  const [pistes, partages, destinataires] = await Promise.all([
    client.from("orientation_pistes").select("id, owner_id, kind, intitule, organisation, statut, contact_pro, echeance, notes, version").order("updated_at", { ascending: false }),
    client.from("orientation_partages").select("piste_id, destinataire_id"),
    client.rpc("demande_destinataires"),
  ]);
  const lignes = (pistes.data ?? []) as Piste[];
  const miennes = lignes.filter((l) => l.owner_id === ctx.personne.profileId);
  const recues = lignes.filter((l) => l.owner_id !== ctx.personne.profileId);
  const adultes = ((destinataires.data ?? []) as { profile_id: string; prenom: string; nom: string }[]).map((d) => ({ id: d.profile_id, nom: `${d.prenom} ${d.nom}` }));
  const lesPartages = (partages.data ?? []) as { piste_id: string; destinataire_id: string }[];
  const noms = await nomsAffichables(ctx.jeton, [...recues.map((r) => r.owner_id), ...lesPartages.map((p) => p.destinataire_id)]);
  const intentions = miennes.filter((m) => m.kind === "intention" && garde(m.kind));
  const autres = miennes.filter((m) => m.kind !== "intention" && garde(m.kind));

  return <VueOrientation filtre={filtre} miennes={miennes} intentions={intentions} autres={autres} recues={recues} adultes={adultes} lesPartages={lesPartages} noms={noms} />;
}
