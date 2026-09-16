import "server-only";

import { clientUtilisateur } from "./supabase-serveur.ts";

/**
 * Données du Studio — cahier V2, §9.
 *
 * Tout passe par le **jeton de la personne connectée**, jamais par la clé de
 * service. C'est la différence qui compte : ce sont les politiques RLS qui
 * décident ce qu'un professeur voit et modifie, pas une vérification écrite
 * dans un écran qu'on pourrait contourner en changeant une adresse.
 *
 * Conséquence directe, et voulue : ces fonctions renvoient des listes vides ou
 * `null` quand la personne n'a pas le droit. Elles ne lèvent pas d'erreur
 * « accès refusé » — ce serait déjà dire que l'objet existe.
 */

/* -------------------------------------------------------------------------- */
/* Cours (espaces d'enseignement)                                              */
/* -------------------------------------------------------------------------- */

export interface Cours {
  readonly id: string;
  readonly matiere: string;
  readonly classe: string | null;
  readonly groupe: string | null;
  /** Libellé affiché : « Mathématiques — Première 3 ». */
  readonly libelle: string;
}

interface LigneEspace {
  id: string;
  subjects: { label: string } | null;
  classes: { label: string } | null;
  teaching_groups: { label: string } | null;
}

/** Les cours où la personne enseigne. La liste vient de RLS, pas d'un filtre. */
export async function coursDuProfesseur(jeton: string): Promise<Cours[]> {
  const client = clientUtilisateur(jeton);

  const { data, error } = await client
    .from("teaching_spaces")
    .select("id, subjects(label), classes(label), teaching_groups(label)")
    .is("archived_at", null)
    .limit(100);

  if (error !== null) {
    journaliser("studio.cours", error.code);
    return [];
  }

  return ((data ?? []) as unknown as LigneEspace[]).map((ligne) => {
    const matiere = ligne.subjects?.label ?? "Matière";
    const cible = ligne.classes?.label ?? ligne.teaching_groups?.label ?? null;
    return {
      id: ligne.id,
      matiere,
      classe: ligne.classes?.label ?? null,
      groupe: ligne.teaching_groups?.label ?? null,
      libelle: cible === null ? matiere : `${matiere} — ${cible}`,
    };
  });
}

/* -------------------------------------------------------------------------- */
/* Chapitres                                                                   */
/* -------------------------------------------------------------------------- */

export interface Chapitre {
  readonly id: string;
  readonly label: string;
  readonly position: number;
}

export async function chapitresDuCours(jeton: string, cours: string): Promise<Chapitre[]> {
  const client = clientUtilisateur(jeton);

  const { data, error } = await client
    .from("chapters")
    .select("id, label, position")
    .eq("teaching_space_id", cours)
    .order("position")
    .limit(200);

  if (error !== null) {
    journaliser("studio.chapitres", error.code);
    return [];
  }
  return (data ?? []) as unknown as Chapitre[];
}

/* -------------------------------------------------------------------------- */
/* Séances                                                                     */
/* -------------------------------------------------------------------------- */

export interface Seance {
  readonly id: string;
  readonly title: string;
  readonly objective: string | null;
  readonly state: "brouillon" | "programmee" | "publiee" | "archivee";
  readonly chapter_id: string | null;
  readonly teaching_space_id: string;
  readonly scheduled_for: string | null;
  readonly published_at: string | null;
  readonly updated_at: string;
}

export async function seancesDuCours(jeton: string, cours: string): Promise<Seance[]> {
  const client = clientUtilisateur(jeton);

  const { data, error } = await client
    .from("lessons")
    .select(
      "id, title, objective, state, chapter_id, teaching_space_id, scheduled_for, published_at, updated_at",
    )
    .eq("teaching_space_id", cours)
    .is("archived_at", null)
    .order("scheduled_for", { ascending: false, nullsFirst: false })
    .limit(300);

  if (error !== null) {
    journaliser("studio.seances", error.code);
    return [];
  }
  return (data ?? []) as unknown as Seance[];
}

export async function seance(jeton: string, id: string): Promise<Seance | null> {
  const client = clientUtilisateur(jeton);

  const { data, error } = await client
    .from("lessons")
    .select(
      "id, title, objective, state, chapter_id, teaching_space_id, scheduled_for, published_at, updated_at",
    )
    .eq("id", id)
    .maybeSingle();

  if (error !== null) {
    journaliser("studio.seance", error.code);
    return null;
  }
  return (data as unknown as Seance) ?? null;
}

/* -------------------------------------------------------------------------- */
/* Blocs                                                                       */
/* -------------------------------------------------------------------------- */

export type TypeBloc = "texte" | "document" | "lien" | "exercice" | "devoir";

export interface Bloc {
  readonly id: string;
  readonly kind: TypeBloc;
  readonly position: number;
  readonly contenu: Record<string, unknown>;
  readonly file_id: string | null;
  readonly assignment_id: string | null;
}

export async function blocsDeLaSeance(jeton: string, seanceId: string): Promise<Bloc[]> {
  const client = clientUtilisateur(jeton);

  const { data, error } = await client
    .from("lesson_blocks")
    .select("id, kind, position, contenu, file_id, assignment_id")
    .eq("lesson_id", seanceId)
    .order("position")
    .limit(200);

  if (error !== null) {
    journaliser("studio.blocs", error.code);
    return [];
  }
  return (data ?? []) as unknown as Bloc[];
}

/* -------------------------------------------------------------------------- */
/* Devoirs                                                                     */
/* -------------------------------------------------------------------------- */

export interface Devoir {
  readonly id: string;
  readonly title: string;
  readonly instructions: Record<string, unknown>;
  readonly due_at: string | null;
  readonly state: string;
  readonly lesson_id: string | null;
  readonly teaching_space_id: string;
}

export async function devoirsDuCours(jeton: string, cours: string): Promise<Devoir[]> {
  const client = clientUtilisateur(jeton);

  const { data, error } = await client
    .from("assignments")
    .select("id, title, instructions, due_at, state, lesson_id, teaching_space_id")
    .eq("teaching_space_id", cours)
    .order("due_at", { ascending: true, nullsFirst: false })
    .limit(200);

  if (error !== null) {
    journaliser("studio.devoirs", error.code);
    return [];
  }
  return (data ?? []) as unknown as Devoir[];
}

/* -------------------------------------------------------------------------- */
/* Vue d'ensemble d'une séance, en une seule fonction                          */
/* -------------------------------------------------------------------------- */

export interface SeanceComplete {
  readonly seance: Seance;
  readonly blocs: Bloc[];
  readonly cours: Cours | null;
  readonly chapitre: Chapitre | null;
}

/**
 * Tout ce qu'il faut pour afficher une séance, côté Studio comme côté élève.
 *
 * `null` si la séance n'existe pas **ou** si la personne n'y a pas droit : la
 * page répond alors 404, sans confirmer l'existence de l'objet.
 */
export async function seanceComplete(
  jeton: string,
  id: string,
): Promise<SeanceComplete | null> {
  const laSeance = await seance(jeton, id);
  if (laSeance === null) return null;

  const [blocs, cours, chapitres] = await Promise.all([
    blocsDeLaSeance(jeton, id),
    coursDuProfesseur(jeton),
    laSeance.chapter_id === null
      ? Promise.resolve([] as Chapitre[])
      : chapitresDuCours(jeton, laSeance.teaching_space_id),
  ]);

  return {
    seance: laSeance,
    blocs,
    cours: cours.find((c) => c.id === laSeance.teaching_space_id) ?? null,
    chapitre: chapitres.find((c) => c.id === laSeance.chapter_id) ?? null,
  };
}

/* -------------------------------------------------------------------------- */

function journaliser(contexte: string, code: string | undefined): void {
  // Un refus RLS est un cas normal, pas un incident : il ne pollue pas le
  // journal. On ne note que ce qui ressemble à une panne.
  if (code === "42501" || code === "PGRST116") return;
  console.error(JSON.stringify({ niveau: "erreur", contexte, code: code ?? "inconnu" }));
}
