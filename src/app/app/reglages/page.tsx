import { clientUtilisateur } from "@/lib/supabase-serveur";
import { contexteApp } from "@/lib/v6/contexte";
import { ONGLETS } from "./vue";
import { VueReglages } from "./vue";

export const metadata = { title: "Réglages" };
export const dynamic = "force-dynamic";

/**
 * A20 — Réglages (maquette R2 n° 5, « Paramètres ») : quatre onglets servis
 * par le serveur (sans script), une carte de profil, puis les mêmes
 * formulaires qu'avant — alertes et horaires calmes, mouvement, copies
 * locales, sécurité, données. Se déconnecter n'est pas supprimer son
 * compte : les deux gestes sont séparés et nommés.
 */
export default async function PageReglages({ searchParams }: { searchParams: Promise<{ onglet?: string }> }) {
  const ctx = await contexteApp();
  const { onglet: demande } = await searchParams;
  const onglet = ONGLETS.find((o) => o.cle === demande)?.cle ?? "compte";
  const { data } = await clientUtilisateur(ctx.jeton)
    .from("preferences_notifications")
    .select("categories, calme_debut, calme_fin, copies_locales")
    .maybeSingle();
  const p = (data ?? {}) as { categories?: Record<string, boolean>; calme_debut?: string; calme_fin?: string; copies_locales?: boolean };
  const initiales = `${ctx.personne.prenom[0] ?? ""}${ctx.personne.nom[0] ?? ""}`.toUpperCase();
  const role = ctx.roles.admin ? "Administration" : ctx.roles.professeur ? "Professeur" : "Élève";

  return <VueReglages onglet={onglet} ctx={ctx} p={p} initiales={initiales} role={role} />;
}
