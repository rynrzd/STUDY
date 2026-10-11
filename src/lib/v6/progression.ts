import "server-only";

import { clientUtilisateur } from "../supabase-serveur.ts";
import { LIBELLE_STATUT } from "./revision.ts";

/**
 * « Où j'en suis » — la progression d'un élève, notion par notion, lisible.
 *
 * Les notions consolidées sortaient des suggestions de révision et
 * n'apparaissaient plus nulle part : l'élève qui progressait ne voyait jamais
 * sa progression. Ici, chaque notion qui a un exercice publié est rangée par
 * matière avec son état écrit en toutes lettres, les réussites récentes sans
 * aide et la prochaine révision prévue. Ni note, ni pourcentage, ni
 * classement : des repères pour soi.
 *
 * Lectures sous le jeton de l'élève, filtrées en plus sur son identifiant :
 * un professeur peut lire certaines tentatives de ses élèves, et cette vue ne
 * doit jamais mélanger les siennes avec les leurs.
 */

export type Statut = "a_revoir" | "en_cours" | "a_decouvrir" | "consolide" | "inconnu";

export interface NotionSuivie {
  readonly id: string;
  readonly notion: string;
  readonly statut: Statut;
  readonly libelleStatut: string;
  /** Réussites sans aide parmi les 5 dernières tentatives. */
  readonly reussitesRecentes: number;
  readonly tentativesRecentes: number;
  readonly prochaineRevision: string | null;
  readonly rappelsActifs: boolean;
}

export interface MatiereSuivie {
  readonly matiere: string;
  readonly notions: readonly NotionSuivie[];
  readonly compte: Readonly<Record<Statut, number>>;
}

const ORDRE: Record<Statut, number> = { a_revoir: 0, en_cours: 1, a_decouvrir: 2, inconnu: 3, consolide: 4 };

export async function maProgression(jeton: string, moi: string): Promise<MatiereSuivie[] | null> {
  const client = clientUtilisateur(jeton);
  const [notions, etats, tentatives, exercices] = await Promise.all([
    client.from("notions").select("id, label, teaching_spaces(subjects(label))").is("archived_at", null).limit(300),
    client.from("etats_revision").select("notion_id, statut, prochaine_revision, rappels_actifs").eq("profile_id", moi),
    client
      .from("tentatives")
      .select("correct, aide_utilisee, created_at, exercice_versions(exercices(notion_id))")
      .eq("profile_id", moi)
      .order("created_at", { ascending: false })
      .limit(500),
    client.from("exercices").select("notion_id, exercice_versions(published_at)").is("archived_at", null).not("notion_id", "is", null).limit(600),
  ]);
  if (notions.error !== null || etats.error !== null) return null;

  const avecExercice = new Set(
    ((exercices.data ?? []) as unknown as { notion_id: string; exercice_versions: { published_at: string | null }[] }[])
      .filter((e) => (e.exercice_versions ?? []).some((v) => v.published_at))
      .map((e) => e.notion_id),
  );
  const etatPar = new Map(
    ((etats.data ?? []) as { notion_id: string; statut: Statut; prochaine_revision: string | null; rappels_actifs: boolean }[]).map((e) => [e.notion_id, e]),
  );
  const recentesPar = new Map<string, { correct: boolean; aide: boolean }[]>();
  for (const t of (tentatives.data ?? []) as unknown as { correct: boolean | null; aide_utilisee: boolean; exercice_versions: { exercices: { notion_id: string | null } | null } | null }[]) {
    const n = t.exercice_versions?.exercices?.notion_id;
    if (!n || t.correct === null) continue;
    const liste = recentesPar.get(n) ?? [];
    if (liste.length < 5) liste.push({ correct: t.correct, aide: t.aide_utilisee });
    recentesPar.set(n, liste);
  }

  const parMatiere = new Map<string, NotionSuivie[]>();
  for (const n of (notions.data ?? []) as unknown as { id: string; label: string; teaching_spaces: { subjects: { label: string } | null } | null }[]) {
    const etat = etatPar.get(n.id);
    if (!avecExercice.has(n.id) && !etat) continue; // rien à travailler, rien à montrer
    const recentes = recentesPar.get(n.id) ?? [];
    const statut: Statut = etat?.statut ?? (recentes.length > 0 ? "en_cours" : "a_decouvrir");
    const matiere = n.teaching_spaces?.subjects?.label ?? "Autres";
    const liste = parMatiere.get(matiere) ?? [];
    parMatiere.set(matiere, liste);
    liste.push({
      id: n.id,
      notion: n.label,
      statut,
      libelleStatut: LIBELLE_STATUT[statut] ?? statut,
      reussitesRecentes: recentes.filter((r) => r.correct && !r.aide).length,
      tentativesRecentes: recentes.length,
      prochaineRevision: etat?.prochaine_revision ?? null,
      rappelsActifs: etat?.rappels_actifs ?? true,
    });
  }

  return [...parMatiere.entries()]
    .map(([matiere, liste]) => {
      const compte = { a_revoir: 0, en_cours: 0, a_decouvrir: 0, consolide: 0, inconnu: 0 } as Record<Statut, number>;
      for (const n of liste) compte[n.statut] += 1;
      return {
        matiere,
        notions: [...liste].sort((a, b) => ORDRE[a.statut] - ORDRE[b.statut] || a.notion.localeCompare(b.notion, "fr")),
        compte,
      };
    })
    .sort((a, b) => a.matiere.localeCompare(b.matiere, "fr"));
}
