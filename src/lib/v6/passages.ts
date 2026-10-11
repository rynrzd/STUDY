import "server-only";

import { clientUtilisateur } from "../supabase-serveur.ts";

/**
 * « Je n'ai pas compris ce passage » (migration 0062). Toute erreur de
 * lecture rend `null`, que l'appelant traduit par « bloc masqué » : le code
 * reste utilisable si la migration n'est pas encore appliquée.
 */

export interface MonPassage {
  readonly id: string;
  readonly extrait: string;
}

export interface PassageDeClasse {
  readonly extrait: string;
  readonly eleves: number;
  readonly dernier: string;
}

/** Les passages que la personne a signalés sur cette séance (ses lignes, par RLS). */
export async function mesPassagesIncompris(jeton: string, seance: string): Promise<MonPassage[] | null> {
  const { data, error } = await clientUtilisateur(jeton)
    .from("passages_incompris")
    .select("id, extrait")
    .eq("lesson_id", seance)
    .is("compris_le", null)
    .order("created_at", { ascending: true })
    .limit(30);
  return error !== null ? null : ((data ?? []) as MonPassage[]);
}

/** Côté professeur : passages non compris d'une séance qu'il enseigne, en nombres. */
export async function passagesIncomprisDeLaSeance(jeton: string, seance: string): Promise<PassageDeClasse[] | null> {
  const { data, error } = await clientUtilisateur(jeton).rpc("passages_incompris_seance", { p_lecon: seance });
  return error !== null ? null : ((data ?? []) as PassageDeClasse[]);
}

/** Côté professeur : par séance enseignée, passages et élèves concernés (30 jours). */
export async function resumePassagesIncompris(jeton: string): Promise<Map<string, { titre: string; passages: number; eleves: number }>> {
  const { data, error } = await clientUtilisateur(jeton).rpc("passages_incompris_resume");
  if (error !== null) return new Map();
  return new Map(((data ?? []) as { lesson_id: string; titre: string; passages: number; eleves: number }[]).map((r) => [r.lesson_id, { titre: r.titre, passages: r.passages, eleves: r.eleves }]));
}
