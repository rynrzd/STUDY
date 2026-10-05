import "server-only";

import type { Carte, Limite, Section } from "../revision/assemblage.ts";
import { clientUtilisateur } from "../supabase-serveur.ts";

/** Fiches, cartes, entraînements et carnet — E04 à E07, E23, E40. */

export const FORMATS = {
  essentiel: { libelle: "L'essentiel", aide: "Les notions et méthodes clés, en extraits courts." },
  detaille: { libelle: "Explication détaillée", aide: "Les passages complets, pour comprendre." },
  cartes: { libelle: "Cartes mémoire", aide: "Une question, une réponse tirée du cours." },
  quiz: { libelle: "Quiz", aide: "Les exercices publiés par ton professeur." },
  controle: { libelle: "Préparer un contrôle", aide: "L'essentiel, une liste de vérification et les exercices." },
} as const;

export type FormatFiche = keyof typeof FORMATS;

export const ETATS_FICHE: Record<string, { libelle: string; ton: "neutre" | "rose" | "succes" | "attention" | "erreur" }> = {
  queued: { libelle: "En file", ton: "neutre" },
  processing: { libelle: "En préparation", ton: "rose" },
  needs_review: { libelle: "Précision demandée", ton: "attention" },
  ready: { libelle: "Prête", ton: "succes" },
  failed: { libelle: "Non restituée", ton: "erreur" },
  canceled: { libelle: "Annulée", ton: "neutre" },
};

export interface FicheListe {
  readonly id: string;
  readonly titre: string;
  readonly format: FormatFiche;
  readonly etat: string;
  readonly majLe: string;
}

export async function mesFiches(jeton: string): Promise<FicheListe[] | null> {
  const { data, error } = await clientUtilisateur(jeton)
    .from("fiches_revision")
    .select("id, titre, format, etat, updated_at")
    .order("updated_at", { ascending: false })
    .limit(60);
  if (error !== null) return null;
  return ((data ?? []) as { id: string; titre: string; format: FormatFiche; etat: string; updated_at: string }[]).map((f) => ({
    id: f.id,
    titre: f.titre,
    format: f.format,
    etat: f.etat,
    majLe: f.updated_at,
  }));
}

export interface FicheLue {
  readonly id: string;
  readonly titre: string;
  readonly format: FormatFiche;
  readonly objectif: string;
  readonly longueur: string;
  readonly etat: string;
  readonly sources: readonly { lesson_id?: string; titre?: string; content_version_id?: string | null; retiree?: boolean }[];
  readonly sections: readonly Section[] | null;
  readonly cartes: readonly Carte[] | null;
  readonly exercices: readonly string[] | null;
  readonly limites: readonly Limite[];
  readonly erreur: string | null;
  readonly validation: string;
  readonly version: number;
  readonly generateurVersion: string;
  readonly creeLe: string;
  readonly majLe: string;
  readonly sourcesLisibles: boolean;
  readonly sourceModifiee: boolean;
}

export async function lireFiche(jeton: string, id: string): Promise<FicheLue | null> {
  if (!/^[0-9a-f-]{36}$/iu.test(id)) return null;
  const { data, error } = await clientUtilisateur(jeton).rpc("fiche_lire", { p_fiche: id });
  if (error !== null) return null;
  const f = ((data ?? []) as Record<string, unknown>[])[0];
  if (!f) return null;
  return {
    id: String(f.id),
    titre: String(f.titre),
    format: f.format as FormatFiche,
    objectif: String(f.objectif),
    longueur: String(f.longueur),
    etat: String(f.etat),
    sources: (f.sources ?? []) as FicheLue["sources"],
    sections: (f.sections ?? null) as Section[] | null,
    cartes: (f.cartes ?? null) as Carte[] | null,
    exercices: (f.exercices ?? null) as string[] | null,
    limites: (f.limites ?? []) as Limite[],
    erreur: (f.erreur ?? null) as string | null,
    validation: String(f.validation),
    version: Number(f.version),
    generateurVersion: String(f.generateur_version),
    creeLe: String(f.created_at),
    majLe: String(f.updated_at),
    sourcesLisibles: Boolean(f.sources_lisibles),
    sourceModifiee: Boolean(f.source_modifiee),
  };
}

export interface SeanceChoisissable {
  readonly id: string;
  readonly titre: string;
  readonly cours: string;
  readonly coursId: string;
  readonly publieeLe: string | null;
}

export async function seancesChoisissables(jeton: string): Promise<SeanceChoisissable[]> {
  const { data } = await clientUtilisateur(jeton)
    .from("lessons")
    .select("id, title, published_at, teaching_space_id, teaching_spaces(subjects(label))")
    .eq("state", "publiee")
    .is("archived_at", null)
    .order("published_at", { ascending: false })
    .limit(200);
  return ((data ?? []) as unknown as {
    id: string;
    title: string;
    published_at: string | null;
    teaching_space_id: string;
    teaching_spaces: { subjects: { label: string } | null } | null;
  }[]).map((l) => ({
    id: l.id,
    titre: l.title,
    cours: l.teaching_spaces?.subjects?.label ?? "Cours",
    coursId: l.teaching_space_id,
    publieeLe: l.published_at,
  }));
}

export async function disponibilites(jeton: string, lecons: readonly string[]) {
  if (lecons.length === 0) return new Map<string, { passages: number; exercices: number }>();
  const { data } = await clientUtilisateur(jeton).rpc("seances_textes_disponibles", { p_lecons: lecons });
  return new Map(
    ((data ?? []) as { lesson_id: string; passages: number; exercices: number }[]).map((d) => [d.lesson_id, { passages: d.passages, exercices: d.exercices }]),
  );
}

export interface QuestionSession {
  readonly versionId: string;
  readonly ordre: number;
  readonly kind: "qcm" | "numerique" | "texte";
  readonly enonce: string;
  readonly choix: readonly string[] | null;
  readonly notion: string | null;
  readonly tentativeId: string | null;
  readonly correct: boolean | null;
  readonly reponse: Record<string, unknown> | null;
}

export async function etatEntrainement(jeton: string, session: string): Promise<{ titre: string; questions: QuestionSession[] } | null> {
  if (!/^[0-9a-f-]{36}$/iu.test(session)) return null;
  const client = clientUtilisateur(jeton);
  const [s, q] = await Promise.all([
    client.from("sessions_entrainement").select("titre").eq("id", session).maybeSingle(),
    client.rpc("entrainement_etat", { p_session: session }),
  ]);
  if (s.data === null || q.error !== null) return null;
  return {
    titre: (s.data as { titre: string }).titre,
    questions: ((q.data ?? []) as {
      version_id: string;
      ordre: number;
      kind: QuestionSession["kind"];
      enonce: string;
      choix: string[] | null;
      notion: string | null;
      tentative_id: string | null;
      correct: boolean | null;
      reponse: Record<string, unknown> | null;
    }[]).map((x) => ({
      versionId: x.version_id,
      ordre: x.ordre,
      kind: x.kind,
      enonce: x.enonce,
      choix: x.choix,
      notion: x.notion,
      tentativeId: x.tentative_id,
      correct: x.correct,
      reponse: x.reponse,
    })),
  };
}
