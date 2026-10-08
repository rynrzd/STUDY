import { clientUtilisateur } from "@/lib/supabase-serveur";
import { contexteApp } from "@/lib/v6/contexte";
import { VueNouvelleDemande } from "./vue";

export const metadata = { title: "Écrire à un adulte" };
export const dynamic = "force-dynamic";

/**
 * A19 — Demander à un adulte (maquette R2 n° 5, « Demande de rendez-vous ») :
 * l'encadré de confidentialité en tête dit exactement qui lit, puis à gauche
 * pourquoi écrire ici, à droite le message. Le destinataire est choisi parmi
 * les adultes qui encadrent l'élève (RPC demande_destinataires). Aucun
 * créneau de rendez-vous : la fonction n'existe pas côté serveur.
 */
export default async function PageNouvelleDemande({ searchParams }: { searchParams: Promise<{ seance?: string; sujet?: string }> }) {
  const ctx = await contexteApp();
  const q = await searchParams;
  const { data } = await clientUtilisateur(ctx.jeton).rpc("demande_destinataires");
  const destinataires = ((data ?? []) as { profile_id: string; prenom: string; nom: string; qualite: string }[]).map((d) => ({
    id: d.profile_id,
    nom: `${d.prenom} ${d.nom}`,
    qualite: d.qualite,
  }));
  const lecon = q.seance && /^[0-9a-f-]{36}$/iu.test(q.seance) ? q.seance : undefined;
  const sujetInitial = q.sujet?.slice(0, 140);
  return <VueNouvelleDemande destinataires={destinataires} lecon={lecon} sujetInitial={sujetInitial} />;
}
