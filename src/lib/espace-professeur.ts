import "server-only";

import { clientUtilisateur } from "./supabase-serveur.ts";

/**
 * Note une panne, et seulement une panne.
 *
 * Un refus RLS est normal. Une requête que PostgREST ne sait pas résoudre ne
 * l'est pas : sans cette trace, une liste vide ressemble à « pas d'élèves »
 * alors qu'elle veut dire « la requête n'a jamais abouti ».
 */
function journaliser(contexte: string, code: string | undefined): void {
  if (code === "42501" || code === "PGRST116") return;
  console.error(JSON.stringify({ niveau: "erreur", contexte, code: code ?? "inconnu" }));
}
import type { Cours } from "./studio.ts";

/**
 * Données du tableau de bord professeur — cahier V2, §8.
 *
 * Même règle que le Studio : tout passe par le jeton de la personne, donc par
 * RLS. Rien ici n'accepte d'identifiant d'établissement ou de classe venant du
 * navigateur pour élargir le périmètre.
 */

export interface SeanceProf {
  readonly id: string;
  readonly title: string;
  readonly state: string;
  readonly scheduled_for: string | null;
  readonly teaching_space_id: string;
}

/** Les séances de tous les cours du professeur, la plus récente d'abord. */
export async function seancesDuProfesseur(jeton: string, limite = 200): Promise<SeanceProf[]> {
  const { data, error } = await clientUtilisateur(jeton)
    .from("lessons")
    .select("id, title, state, scheduled_for, teaching_space_id")
    .is("archived_at", null)
    .order("scheduled_for", { ascending: false, nullsFirst: false })
    .limit(limite);

  if (error !== null) return [];
  return (data ?? []) as unknown as SeanceProf[];
}

export interface DevoirProf {
  readonly id: string;
  readonly title: string;
  readonly due_at: string | null;
  readonly state: string;
  readonly lesson_id: string | null;
  readonly teaching_space_id: string;
}

export async function devoirsDuProfesseur(jeton: string): Promise<DevoirProf[]> {
  const { data, error } = await clientUtilisateur(jeton)
    .from("assignments")
    .select("id, title, due_at, state, lesson_id, teaching_space_id")
    .order("due_at", { ascending: true, nullsFirst: false })
    .limit(200);

  if (error !== null) return [];
  return (data ?? []) as unknown as DevoirProf[];
}

export interface EleveDeClasse {
  readonly id: string;
  readonly prenom: string;
  readonly nom: string;
}

/**
 * Les élèves inscrits dans une classe.
 *
 * L'identifiant de classe vient de l'écran, donc du navigateur : c'est RLS qui
 * garantit que le professeur ne lira que les classes où il enseigne. Une classe
 * étrangère renvoie une liste vide, et l'écran affiche « classe introuvable ».
 */
export async function elevesDeLaClasse(jeton: string, classe: string): Promise<EleveDeClasse[]> {
  const client = clientUtilisateur(jeton);

  // Les noms sont relus séparément, et ce n'est pas un choix de style.
  //
  // `class_enrollments.profile_id` référence `organization_memberships`, pas
  // `profiles` : PostgREST ne sait pas faire le rapprochement et refusait la
  // requête (PGRST200). L'erreur était avalée, la fonction rendait un tableau
  // vide — et un professeur ne voyait **jamais** les élèves de sa classe.
  const { data, error } = await client
    .from("class_enrollments")
    .select("profile_id")
    .eq("class_id", classe)
    .limit(400);

  if (error !== null) {
    journaliser("professeur.eleves", error.code);
    return [];
  }

  const identifiants = ((data ?? []) as { profile_id: string }[]).map((ligne) => ligne.profile_id);
  if (identifiants.length === 0) return [];

  const { data: profils, error: erreurProfils } = await client
    .from("profiles")
    .select("id, first_name, last_name")
    .in("id", identifiants);

  if (erreurProfils !== null) {
    journaliser("professeur.eleves.noms", erreurProfils.code);
    return [];
  }

  return ((profils ?? []) as { id: string; first_name: string; last_name: string }[])
    .map((profil) => ({ id: profil.id, prenom: profil.first_name, nom: profil.last_name }))
    .sort((a, b) => a.nom.localeCompare(b.nom, "fr") || a.prenom.localeCompare(b.prenom, "fr"));
}

/** Combien d'élèves par classe, pour la liste « Mes classes ». */
export async function effectifsParClasse(jeton: string): Promise<Map<string, number>> {
  const { data, error } = await clientUtilisateur(jeton)
    .from("class_enrollments")
    .select("class_id")
    .limit(2000);

  const effectifs = new Map<string, number>();
  if (error !== null) return effectifs;

  for (const ligne of (data ?? []) as unknown as { class_id: string }[]) {
    effectifs.set(ligne.class_id, (effectifs.get(ligne.class_id) ?? 0) + 1);
  }
  return effectifs;
}

/** Les classes distinctes derrière les cours du professeur. */
export async function classesDuProfesseur(
  jeton: string,
  cours: readonly Cours[],
): Promise<{ id: string; label: string; matieres: string[] }[]> {
  const { data, error } = await clientUtilisateur(jeton)
    .from("teaching_spaces")
    .select("class_id, subjects(label), classes(id, label)")
    .is("archived_at", null)
    .not("class_id", "is", null)
    .limit(200);

  if (error !== null) return [];

  const parClasse = new Map<string, { id: string; label: string; matieres: string[] }>();

  for (const ligne of (data ?? []) as unknown as {
    class_id: string | null;
    subjects: { label: string } | null;
    classes: { id: string; label: string } | null;
  }[]) {
    if (ligne.classes === null) continue;
    const existante = parClasse.get(ligne.classes.id);
    const matiere = ligne.subjects?.label ?? "Matière";
    if (existante === undefined) {
      parClasse.set(ligne.classes.id, {
        id: ligne.classes.id,
        label: ligne.classes.label,
        matieres: [matiere],
      });
    } else if (!existante.matieres.includes(matiere)) {
      existante.matieres.push(matiere);
    }
  }

  // `cours` sert à conserver l'ordre d'affichage du Studio quand il existe.
  const ordre = new Map(cours.map((c, index) => [c.classe, index] as const));
  return [...parClasse.values()].sort(
    (a, b) => (ordre.get(a.label) ?? 999) - (ordre.get(b.label) ?? 999),
  );
}
