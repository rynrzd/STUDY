import { redirect } from "next/navigation";
import { clientUtilisateur } from "@/lib/supabase-serveur";
import { contexteApp } from "@/lib/v6/contexte";
import type { DemandeRecuperation } from "./vue";
import { VueRecuperation } from "./vue";

export const metadata = { title: "Demandes d'accès" };
export const dynamic = "force-dynamic";

/**
 * D03 — Récupérations : la file à gauche, le détail à droite. Contrôle
 * d'identité hors application (aucune pièce stockée), référence annoncée par
 * la personne, puis lien temporaire (3 jours, usage unique) ; ou classement
 * sans suite. Aucun ancien mot de passe n'existe ni n'est affiché.
 */
export default async function PageRecuperation({ searchParams }: { searchParams: Promise<{ demande?: string }> }) {
  const ctx = await contexteApp();
  if (!ctx.roles.admin) redirect("/app");
  const { demande } = await searchParams;
  const { data, error } = await clientUtilisateur(ctx.jeton).rpc("recuperation_a_traiter");
  const demandes = (data ?? []) as DemandeRecuperation[];
  const choisie = demandes.find((d) => d.id === demande) ?? demandes[0] ?? null;

  return <VueRecuperation error={error} demandes={demandes} choisie={choisie} />;
}
