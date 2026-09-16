import "server-only";

import { clientUtilisateur } from "./supabase-serveur.ts";

/**
 * Données de l'espace élève — cahier V2, §7 et §10.
 *
 * Comme le Studio, tout passe par le jeton de la personne : c'est RLS qui
 * décide ce qu'un élève voit. Un élève de Seconde 1 qui demanderait la séance
 * d'une Seconde 2 ne reçoit pas un refus, il reçoit zéro ligne — et la page
 * répond 404.
 *
 * Aucune de ces fonctions n'accepte d'identifiant de classe ou d'élève venant
 * du navigateur : le périmètre est celui de la session, point.
 */

export interface CoursEleve {
  readonly id: string;
  readonly matiere: string;
  readonly classe: string | null;
  readonly libelle: string;
}

interface LigneEspace {
  id: string;
  subjects: { label: string } | null;
  classes: { label: string } | null;
  teaching_groups: { label: string } | null;
}

/** Les cours auxquels l'élève assiste. */
export async function coursDeLEleve(jeton: string): Promise<CoursEleve[]> {
  const { data, error } = await clientUtilisateur(jeton)
    .from("teaching_spaces")
    .select("id, subjects(label), classes(label), teaching_groups(label)")
    .is("archived_at", null)
    .limit(60);

  if (error !== null) return [];

  return ((data ?? []) as unknown as LigneEspace[]).map((ligne) => {
    const matiere = ligne.subjects?.label ?? "Matière";
    const cible = ligne.classes?.label ?? ligne.teaching_groups?.label ?? null;
    return {
      id: ligne.id,
      matiere,
      classe: cible,
      libelle: cible === null ? matiere : `${matiere} — ${cible}`,
    };
  });
}

export interface SeanceEleve {
  readonly id: string;
  readonly title: string;
  readonly objective: string | null;
  readonly scheduled_for: string | null;
  readonly published_at: string | null;
  readonly updated_at: string;
  readonly teaching_space_id: string;
  readonly chapter_id: string | null;
}

/**
 * Les séances publiées, les plus récentes d'abord.
 *
 * Seules les séances publiées remontent : un brouillon n'est pas « une séance
 * à venir », c'est un document de travail du professeur.
 */
export async function seancesPubliees(
  jeton: string,
  options: { cours?: string; limite?: number } = {},
): Promise<SeanceEleve[]> {
  let requete = clientUtilisateur(jeton)
    .from("lessons")
    .select(
      "id, title, objective, scheduled_for, published_at, updated_at, teaching_space_id, chapter_id",
    )
    .eq("state", "publiee")
    .is("archived_at", null)
    .order("scheduled_for", { ascending: false, nullsFirst: false })
    .limit(options.limite ?? 60);

  if (options.cours !== undefined) requete = requete.eq("teaching_space_id", options.cours);

  const { data, error } = await requete;
  if (error !== null) return [];
  return (data ?? []) as unknown as SeanceEleve[];
}

export interface DevoirEleve {
  readonly id: string;
  readonly title: string;
  readonly due_at: string | null;
  readonly teaching_space_id: string;
  readonly lesson_id: string | null;
}

/** Les devoirs donnés à l'élève, le plus proche en premier. */
export async function devoirsDeLEleve(jeton: string): Promise<DevoirEleve[]> {
  const { data, error } = await clientUtilisateur(jeton)
    .from("assignments")
    .select("id, title, due_at, teaching_space_id, lesson_id")
    .eq("state", "publiee")
    .order("due_at", { ascending: true, nullsFirst: false })
    .limit(120);

  if (error !== null) return [];
  return (data ?? []) as unknown as DevoirEleve[];
}
