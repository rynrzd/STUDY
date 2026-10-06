import "server-only";

import { clientUtilisateur } from "../supabase-serveur.ts";

/**
 * Banque d'exercices (T04). Lecture sous le jeton du professeur : RLS ne
 * rend que les exercices de ses enseignements. Le corrigé n'est lu que pour
 * l'exercice ouvert dans le panneau de détail, et seulement si la politique
 * le permet (professeur de l'espace).
 */

export interface ExerciceBanque {
  readonly exercice: string;
  readonly version: string;
  readonly numero: number;
  readonly kind: "qcm" | "numerique" | "texte";
  readonly enonce: string;
  readonly choix: readonly string[] | null;
  readonly difficulte: 1 | 2 | 3;
  readonly publie: boolean;
  readonly matiere: string;
  readonly cours: string;
  readonly seance: string | null;
  readonly notion: string | null;
  readonly creeLe: string;
  readonly moi: boolean;
}

export interface FiltresBanque {
  readonly q?: string;
  readonly matiere?: string;
  readonly difficultes?: readonly number[];
  readonly type?: string;
  readonly miens?: boolean;
  readonly tri?: "recents" | "anciens";
}

export async function banqueExercices(
  jeton: string,
  moi: string,
  cours: readonly { id: string; matiere: string; libelle: string }[],
  filtres: FiltresBanque,
): Promise<{ exercices: ExerciceBanque[]; total: number; erreur: boolean }> {
  const client = clientUtilisateur(jeton);
  const { data, error } = await client
    .from("exercices")
    .select("id, teaching_space_id, lesson_id, notion_id, created_by, created_at, exercice_versions(id, version, kind, enonce, choix, difficulte, published_at)")
    .is("archived_at", null)
    .order("created_at", { ascending: filtres.tri === "anciens" })
    .limit(400);
  if (error !== null) return { exercices: [], total: 0, erreur: true };
  const lignes = (data ?? []) as unknown as {
    id: string;
    teaching_space_id: string;
    lesson_id: string | null;
    notion_id: string | null;
    created_by: string;
    created_at: string;
    exercice_versions: { id: string; version: number; kind: ExerciceBanque["kind"]; enonce: string; choix: string[] | null; difficulte: 1 | 2 | 3; published_at: string | null }[];
  }[];
  const lecons = [...new Set(lignes.map((l) => l.lesson_id).filter((x): x is string => Boolean(x)))];
  const notions = [...new Set(lignes.map((l) => l.notion_id).filter((x): x is string => Boolean(x)))];
  const [titres, libellesNotions] = await Promise.all([
    lecons.length ? client.from("lessons").select("id, title").in("id", lecons) : Promise.resolve({ data: [] }),
    notions.length ? client.from("notions").select("id, label").in("id", notions) : Promise.resolve({ data: [] }),
  ]);
  const titreLecon = new Map(((titres.data ?? []) as { id: string; title: string }[]).map((x) => [x.id, x.title]));
  const libelleNotion = new Map(((libellesNotions.data ?? []) as { id: string; label: string }[]).map((x) => [x.id, x.label]));
  const parCours = new Map(cours.map((c) => [c.id, c]));
  const recherche = (filtres.q ?? "").trim().toLocaleLowerCase("fr");

  const tous: ExerciceBanque[] = [];
  for (const l of lignes) {
    const derniere = [...l.exercice_versions].sort((a, b) => b.version - a.version)[0];
    if (!derniere) continue;
    const c = parCours.get(l.teaching_space_id);
    tous.push({
      exercice: l.id,
      version: derniere.id,
      numero: derniere.version,
      kind: derniere.kind,
      enonce: derniere.enonce,
      choix: derniere.choix,
      difficulte: derniere.difficulte,
      publie: derniere.published_at !== null,
      matiere: c?.matiere ?? "Matière",
      cours: c?.libelle ?? "Cours",
      seance: l.lesson_id ? (titreLecon.get(l.lesson_id) ?? null) : null,
      notion: l.notion_id ? (libelleNotion.get(l.notion_id) ?? null) : null,
      creeLe: l.created_at,
      moi: l.created_by === moi,
    });
  }
  const exercices = tous.filter(
    (e) =>
      (!recherche || `${e.enonce} ${e.notion ?? ""} ${e.seance ?? ""}`.toLocaleLowerCase("fr").includes(recherche)) &&
      (!filtres.matiere || e.matiere === filtres.matiere) &&
      (!filtres.difficultes?.length || filtres.difficultes.includes(e.difficulte)) &&
      (!filtres.type || e.kind === filtres.type) &&
      (!filtres.miens || e.moi),
  );
  return { exercices, total: tous.length, erreur: false };
}

export async function corrigeDe(jeton: string, version: string) {
  const { data } = await clientUtilisateur(jeton)
    .from("exercice_corriges")
    .select("bonne_reponse, explication, indice, exemple")
    .eq("exercice_version_id", version)
    .maybeSingle();
  return data as { bonne_reponse: unknown; explication: string; indice: string | null; exemple: string | null } | null;
}
