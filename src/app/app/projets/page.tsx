import { clientUtilisateur } from "@/lib/supabase-serveur";
import { contexteApp } from "@/lib/v6/contexte";
import { dateLisible } from "@/components/study/ui";
import type { ProjetLigne } from "./vue";
import { VueProjets } from "./vue";

export const metadata = { title: "Mes projets" };
export const dynamic = "force-dynamic";

/**
 * A15 — Projets (maquette R2 n° 5, « Projets de classe ») : un tableau des
 * projets (nom, visibilité, participants, prochaine étape, dernière
 * activité), en liste sur téléphone, et la création à côté. Personnels
 * (privés) ou de groupe (sur invitation acceptée) ; pas d'accès
 * administratif implicite aux projets privés.
 */
export default async function PageProjets() {
  const ctx = await contexteApp();
  const client = clientUtilisateur(ctx.jeton);
  const [projets, membres, taches] = await Promise.all([
    client.from("projets").select("id, titre, description, visibilite, class_id, updated_at, archived_at").is("archived_at", null).order("updated_at", { ascending: false }),
    client.from("projet_membres").select("projet_id, profile_id, etat, role"),
    client.from("projet_taches").select("projet_id, titre, statut, echeance").neq("statut", "termine").order("echeance", { ascending: true, nullsFirst: false }),
  ]);
  const lignes = (projets.data ?? []) as ProjetLigne[];
  const mesInvitations = ((membres.data ?? []) as { projet_id: string; profile_id: string; etat: string }[]).filter(
    (m) => m.profile_id === ctx.personne.profileId && m.etat === "invite",
  );
  const participants = (id: string) => ((membres.data ?? []) as { projet_id: string; etat: string }[]).filter((m) => m.projet_id === id && m.etat === "actif").length;
  const prochaine = (id: string) => ((taches.data ?? []) as { projet_id: string; titre: string; echeance: string | null }[]).find((t) => t.projet_id === id);
  const invitations = lignes.filter((p) => mesInvitations.some((i) => i.projet_id === p.id));
  const actifs = lignes.filter((p) => !mesInvitations.some((i) => i.projet_id === p.id));
  const classes = ctx.contextes.filter((c) => c.role !== "professeur").map((c) => ({ id: c.classe, libelle: c.libelle }));
  const etapeDe = (id: string) => {
    const t = prochaine(id);
    return t ? `${t.titre}${t.echeance ? ` (${dateLisible(t.echeance, { day: "numeric", month: "short" })})` : ""}` : "Aucune tâche en cours";
  };

  return <VueProjets invitations={invitations} actifs={actifs} classes={classes} participants={participants} etapeDe={etapeDe} />;
}
