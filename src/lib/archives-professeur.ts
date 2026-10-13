import "server-only";

import type { Bloc, Seance } from "./studio.ts";
import { clientUtilisateur } from "./supabase-serveur.ts";

/**
 * Archives du professeur — cahier des charges ch. 18 (YR-07, YR-09), 0076.
 *
 * Tout passe par le jeton de la personne : les fonctions `prof_archive_*`
 * relisent l'appelant en base et ne répondent qu'au titulaire ou au
 * co-intervenant du cours archivé. Lecture seule : rien ici n'écrit.
 */

export interface CoursArchive {
  readonly espace: string;
  readonly annee: string;
  readonly matiere: string;
  readonly cible: string;
  readonly genre: "classe" | "groupe";
  readonly seances: number;
  readonly devoirs: number;
  readonly archive_le: string;
}

export interface ArchiveCours {
  readonly cours: { id: string; matiere: string; cible: string; annee: string; archive_le: string };
  readonly chapitres: readonly { id: string; label: string }[];
  readonly seances: readonly Seance[];
  readonly devoirs: readonly { id: string; title: string; due_at: string | null; remises: number }[];
}

export interface ArchiveSeance {
  readonly seance: Seance;
  readonly chapitre: string | null;
  readonly blocs: readonly Omit<Bloc, "file_id" | "assignment_id">[];
}

/** `null` : lecture refusée ou en échec — affiché « indisponible », jamais « aucun ». */
export async function coursArchives(jeton: string): Promise<CoursArchive[] | null> {
  const { data, error } = await clientUtilisateur(jeton).rpc("prof_cours_archives");
  if (error !== null) {
    console.error(JSON.stringify({ niveau: "erreur", contexte: "archives.liste", code: error.code }));
    return null;
  }
  return (data ?? []) as CoursArchive[];
}

export async function archiveCours(jeton: string, espace: string): Promise<ArchiveCours | null> {
  const { data, error } = await clientUtilisateur(jeton).rpc("prof_archive_cours", { p_espace: espace });
  if (error !== null) return null;
  return data as ArchiveCours;
}

export async function archiveSeance(jeton: string, seance: string): Promise<ArchiveSeance | null> {
  const { data, error } = await clientUtilisateur(jeton).rpc("prof_archive_seance", { p_seance: seance });
  if (error !== null) return null;
  return data as ArchiveSeance;
}
