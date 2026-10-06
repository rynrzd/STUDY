import "server-only";

import { clientUtilisateur } from "../supabase-serveur.ts";

/**
 * Tableau de bord professeur (T01). Tout est lu sous le jeton du professeur :
 * RLS ne rend que ses enseignements, leurs salons, leurs remises et ses
 * ateliers. Ce sont des compteurs de travail, jamais un classement d'élèves.
 */

export interface CarteCours {
  readonly id: string;
  readonly matiere: string;
  readonly classe: string;
  readonly questionsSansReponse: number;
  readonly salon: string | null;
}

export interface TableauProfesseur {
  readonly cartes: readonly CarteCours[];
  readonly questionsEnAttente: number;
  readonly copiesAEvaluer: number;
  readonly reponsesAteliers: number;
  readonly erreur: boolean;
}

export async function tableauProfesseur(jeton: string, cours: readonly { id: string; matiere: string; libelle: string; classe: string | null; groupe: string | null }[]): Promise<TableauProfesseur> {
  const client = clientUtilisateur(jeton);
  const septJours = new Date(Date.now() - 7 * 86_400_000).toISOString();
  const [questions, salons, devoirs, ateliers] = await Promise.all([
    client
      .from("messages_salon")
      .select("id, salon_id")
      .eq("kind", "question")
      .is("parent_id", null)
      .is("deleted_at", null)
      .is("hidden_at", null)
      .order("created_at", { ascending: false })
      .limit(200),
    client.from("salons").select("id, teaching_space_id, kind").eq("kind", "matiere"),
    client.from("assignments").select("id").in("teaching_space_id", cours.map((c) => c.id)),
    client.from("ateliers").select("id").neq("etat", "brouillon"),
  ]);
  const lignes = (questions.data ?? []) as { id: string; salon_id: string }[];
  const compteurs = lignes.length
    ? (((await client.rpc("salon_compteurs", { p_messages: lignes.map((l) => l.id) })).data ?? []) as { message_id: string; reponses: number }[])
    : [];
  const repondues = new Set(compteurs.filter((c) => c.reponses > 0).map((c) => c.message_id));
  const sansReponse = lignes.filter((l) => !repondues.has(l.id));
  const salonParCours = new Map(((salons.data ?? []) as { id: string; teaching_space_id: string | null }[]).filter((s) => s.teaching_space_id).map((s) => [s.teaching_space_id!, s.id]));
  const parSalon = new Map<string, number>();
  for (const q of sansReponse) parSalon.set(q.salon_id, (parSalon.get(q.salon_id) ?? 0) + 1);

  const idsDevoirs = ((devoirs.data ?? []) as { id: string }[]).map((d) => d.id);
  const idsAteliers = ((ateliers.data ?? []) as { id: string }[]).map((a) => a.id);
  const [copies, reponses] = await Promise.all([
    idsDevoirs.length
      ? client.from("submissions").select("id", { count: "exact", head: true }).in("assignment_id", idsDevoirs).in("state", ["remis", "remis_en_retard"])
      : Promise.resolve({ count: 0, error: null }),
    idsAteliers.length
      ? client.from("ateliers_reponses").select("id", { count: "exact", head: true }).in("atelier_id", idsAteliers).gte("updated_at", septJours)
      : Promise.resolve({ count: 0, error: null }),
  ]);

  return {
    cartes: cours.map((c) => {
      const salon = salonParCours.get(c.id) ?? null;
      return { id: c.id, matiere: c.matiere, classe: c.classe ?? c.groupe ?? c.libelle, questionsSansReponse: salon ? (parSalon.get(salon) ?? 0) : 0, salon };
    }),
    questionsEnAttente: sansReponse.length,
    copiesAEvaluer: copies.count ?? 0,
    reponsesAteliers: reponses.count ?? 0,
    erreur: questions.error !== null || devoirs.error !== null,
  };
}
