import "server-only";

import type { DocumentCours, ReglagesPresentation } from "../document-cours.ts";
import { revision } from "../studio-documents.ts";
import { blocsDeLaSeance, type Bloc } from "../studio.ts";
import { clientUtilisateur } from "../supabase-serveur.ts";

/**
 * Cours et séances côté élève — dossier Study V6, §6 et E02, E03, E22.
 * Matière → chapitre → séance → ressources → exercices → devoirs → questions.
 */

export interface CoursResume {
  readonly id: string;
  readonly matiere: string;
  readonly classe: string | null;
  readonly classId: string | null;
  readonly enseignants: string | null;
  readonly seances: number;
  readonly chapitreCourant: string | null;
  readonly dernierePublication: string | null;
  readonly enseigne: boolean;
}

export async function mesCours(jeton: string): Promise<CoursResume[] | null> {
  const { data, error } = await clientUtilisateur(jeton).rpc("mes_cours");
  if (error !== null) return null;
  return ((data ?? []) as {
    id: string;
    matiere: string;
    classe: string | null;
    class_id: string | null;
    enseignants: string | null;
    seances: number;
    chapitre_courant: string | null;
    derniere_publication: string | null;
    enseigne: boolean;
  }[]).map((c) => ({
    id: c.id,
    matiere: c.matiere,
    classe: c.classe,
    classId: c.class_id,
    enseignants: c.enseignants,
    seances: c.seances,
    chapitreCourant: c.chapitre_courant,
    dernierePublication: c.derniere_publication,
    enseigne: c.enseigne,
  }));
}

export interface SeanceListe {
  readonly id: string;
  readonly titre: string;
  readonly objectif: string | null;
  readonly publieeLe: string | null;
  readonly prevueLe: string | null;
  readonly chapitreId: string | null;
}

export interface ChapitreAvecSeances {
  readonly id: string | null;
  readonly libelle: string;
  readonly seances: readonly SeanceListe[];
}

export async function seancesParChapitre(jeton: string, cours: string): Promise<ChapitreAvecSeances[] | null> {
  const client = clientUtilisateur(jeton);
  const [chapitres, seances] = await Promise.all([
    client.from("chapters").select("id, label, position").eq("teaching_space_id", cours).order("position"),
    client
      .from("lessons")
      .select("id, title, objective, published_at, scheduled_for, chapter_id")
      .eq("teaching_space_id", cours)
      .eq("state", "publiee")
      .is("archived_at", null)
      .order("published_at", { ascending: false })
      .limit(200),
  ]);
  if (chapitres.error !== null || seances.error !== null) return null;

  const lignes = (seances.data ?? []) as {
    id: string;
    title: string;
    objective: string | null;
    published_at: string | null;
    scheduled_for: string | null;
    chapter_id: string | null;
  }[];
  const versListe = (l: (typeof lignes)[number]): SeanceListe => ({
    id: l.id,
    titre: l.title,
    objectif: l.objective,
    publieeLe: l.published_at,
    prevueLe: l.scheduled_for,
    chapitreId: l.chapter_id,
  });

  const groupes: ChapitreAvecSeances[] = ((chapitres.data ?? []) as { id: string; label: string }[])
    .map((c) => ({ id: c.id, libelle: c.label, seances: lignes.filter((l) => l.chapter_id === c.id).map(versListe) }))
    .filter((g) => g.seances.length > 0);
  const sansChapitre = lignes.filter((l) => l.chapter_id === null || !groupes.some((g) => g.id === l.chapter_id));
  if (sansChapitre.length > 0) groupes.push({ id: null, libelle: "Autres séances", seances: sansChapitre.map(versListe) });
  return groupes;
}

export interface SeanceDetail {
  readonly id: string;
  readonly titre: string;
  readonly objectif: string | null;
  readonly etat: string;
  readonly publieeLe: string | null;
  readonly majLe: string;
  readonly coursId: string;
  readonly matiere: string | null;
  readonly classId: string | null;
  readonly chapitre: string | null;
  readonly versionId: string | null;
  readonly versionNumero: number | null;
  readonly blocs: readonly Bloc[];
  readonly document: { document: DocumentCours; reglages: ReglagesPresentation } | null;
}

/**
 * Une séance lisible par la personne, ou `null` — sans distinguer « n'existe
 * pas » de « pas à vous » : la page répond pareil dans les deux cas.
 */
export async function seanceDetail(jeton: string, id: string): Promise<SeanceDetail | null> {
  if (!/^[0-9a-f-]{36}$/iu.test(id)) return null;
  const client = clientUtilisateur(jeton);
  const { data, error } = await client
    .from("lessons")
    .select(
      "id, title, objective, state, published_at, updated_at, teaching_space_id, content_version_id, chapters(label), teaching_spaces(class_id, subjects(label))",
    )
    .eq("id", id)
    .is("archived_at", null)
    .maybeSingle();
  if (error !== null || data === null) return null;
  const l = data as unknown as {
    id: string;
    title: string;
    objective: string | null;
    state: string;
    published_at: string | null;
    updated_at: string;
    teaching_space_id: string;
    content_version_id: string | null;
    chapters: { label: string } | null;
    teaching_spaces: { class_id: string | null; subjects: { label: string } | null } | null;
  };

  const [blocs, doc] = await Promise.all([
    blocsDeLaSeance(jeton, id),
    l.content_version_id === null ? Promise.resolve(null) : revision(jeton, l.content_version_id),
  ]);

  return {
    id: l.id,
    titre: l.title,
    objectif: l.objective,
    etat: l.state,
    publieeLe: l.published_at,
    majLe: l.updated_at,
    coursId: l.teaching_space_id,
    matiere: l.teaching_spaces?.subjects?.label ?? null,
    classId: l.teaching_spaces?.class_id ?? null,
    chapitre: l.chapters?.label ?? null,
    versionId: l.content_version_id,
    versionNumero: doc?.numero ?? null,
    blocs,
    document: doc === null || doc.document.blocs.length === 0 ? null : { document: doc.document, reglages: doc.reglages },
  };
}

export interface ExerciceAffiche {
  readonly exerciceId: string;
  readonly versionId: string;
  readonly version: number;
  readonly kind: "qcm" | "numerique" | "texte";
  readonly enonce: string;
  readonly choix: readonly string[] | null;
  readonly difficulte: number;
  readonly notion: string | null;
}

export async function exercicesDeLaSeance(jeton: string, seance: string): Promise<ExerciceAffiche[]> {
  const { data, error } = await clientUtilisateur(jeton).rpc("exercices_de_la_seance", { p_lecon: seance });
  if (error !== null) return [];
  return ((data ?? []) as {
    exercice_id: string;
    version_id: string;
    version: number;
    kind: ExerciceAffiche["kind"];
    enonce: string;
    choix: string[] | null;
    difficulte: number;
    notion: string | null;
  }[]).map((e) => ({
    exerciceId: e.exercice_id,
    versionId: e.version_id,
    version: e.version,
    kind: e.kind,
    enonce: e.enonce,
    choix: e.choix,
    difficulte: e.difficulte,
    notion: e.notion,
  }));
}

export async function notePersonnelle(jeton: string, seance: string): Promise<{ corps: string; revision: number }> {
  const { data } = await clientUtilisateur(jeton)
    .from("personal_notes")
    .select("body, revision")
    .eq("lesson_id", seance)
    .maybeSingle();
  const n = data as { body: string; revision: number } | null;
  return { corps: n?.body ?? "", revision: n?.revision ?? 0 };
}

export async function reperesDeLaSeance(jeton: string, seance: string): Promise<{ aRevoir: boolean; relu: boolean }> {
  const { data } = await clientUtilisateur(jeton).from("reperes_seance").select("kind").eq("lesson_id", seance);
  const kinds = new Set(((data ?? []) as { kind: string }[]).map((r) => r.kind));
  return { aRevoir: kinds.has("a_revoir"), relu: kinds.has("relu") };
}

/** E22 — séances publiées sur une période (bornes ISO calculées dans le fuseau de l'élève). */
export async function rattrapage(jeton: string, debutIso: string, finIso: string) {
  const { data, error } = await clientUtilisateur(jeton)
    .from("lessons")
    .select("id, title, objective, published_at, teaching_space_id, teaching_spaces(subjects(label))")
    .eq("state", "publiee")
    .is("archived_at", null)
    .gte("published_at", debutIso)
    .lt("published_at", finIso)
    .order("published_at")
    .limit(300);
  if (error !== null) return null;
  return (data ?? []) as unknown as {
    id: string;
    title: string;
    objective: string | null;
    published_at: string;
    teaching_space_id: string;
    teaching_spaces: { subjects: { label: string } | null } | null;
  }[];
}
