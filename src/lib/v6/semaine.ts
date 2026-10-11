import "server-only";

import { jourParis, lundiDe, semaineDepuis, type Semaine } from "../semaine.ts";
import { clientUtilisateur } from "../supabase-serveur.ts";

/**
 * Lectures sous le jeton de l'élève, filtrées sur son identifiant : un
 * professeur peut lire certaines tentatives de ses élèves, et ces repères ne
 * doivent jamais mélanger les siennes avec les leurs.
 */

/** Les jours d'entraînement de la semaine en cours ; `null` si la lecture échoue. */
export async function maSemaine(jeton: string, moi: string): Promise<Semaine | null> {
  const aujourdhui = jourParis();
  const { data, error } = await clientUtilisateur(jeton)
    .from("tentatives")
    .select("jour")
    .eq("profile_id", moi)
    .gte("jour", lundiDe(aujourdhui))
    .limit(500);
  if (error !== null) return null;
  return semaineDepuis(((data ?? []) as { jour: string }[]).map((t) => t.jour), aujourdhui);
}

/**
 * Les notions déjà consolidées, par libellé. Sert à ne fêter « Notion
 * consolidée » qu'au passage réel. `null` si la lecture échoue : l'appelant
 * ne fête alors rien plutôt que de fêter à tort.
 */
export async function notionsConsolidees(jeton: string, moi: string): Promise<string[] | null> {
  const { data, error } = await clientUtilisateur(jeton)
    .from("etats_revision")
    .select("notions(label)")
    .eq("profile_id", moi)
    .eq("statut", "consolide")
    .limit(300);
  if (error !== null) return null;
  return ((data ?? []) as unknown as { notions: { label: string } | null }[]).map((e) => e.notions?.label ?? "").filter(Boolean);
}
