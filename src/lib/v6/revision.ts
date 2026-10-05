import "server-only";

import { expliquerPriorite, revisionPriority, VERSION_PARAMETRES } from "../revision/algorithmes.ts";
import { clientUtilisateur } from "../supabase-serveur.ts";

/**
 * Priorités de révision — dossier Study V6, §8.3.
 *
 * P = 0,40·urgence + 0,35·fragilité + 0,15·retard + 0,10·objectif, avec les
 * données de l'élève seulement (RLS : ses états, ses tentatives) et les
 * contrôles annoncés dans l'agenda de ses cours. L'explication affichée cite
 * les faits, jamais le score. Maximum cinq notions par séance, par défaut.
 */

export interface Suggestion {
  readonly notionId: string;
  readonly notion: string;
  readonly cours: string | null;
  readonly statut: string;
  readonly score: number;
  readonly explication: string;
  readonly prochaine: string | null;
  readonly versions: readonly string[];
}

interface LigneNotion {
  id: string;
  label: string;
  teaching_space_id: string;
  chapter_id: string | null;
  teaching_spaces: { subjects: { label: string } | null } | null;
}

const JOUR = 86_400_000;

function joursEntre(depuis: Date, vers: Date): number {
  return Math.round((vers.getTime() - depuis.getTime()) / JOUR);
}

export async function suggestionsDeRevision(
  jeton: string,
  options: { limite?: number; objectif?: readonly string[] } = {},
): Promise<{ suggestions: Suggestion[]; parametres: string }> {
  const client = clientUtilisateur(jeton);
  const maintenant = new Date();
  const [notions, etats, tentatives, controles, exercices] = await Promise.all([
    client
      .from("notions")
      .select("id, label, teaching_space_id, chapter_id, teaching_spaces(subjects(label))")
      .is("archived_at", null)
      .limit(200),
    client.from("etats_revision").select("notion_id, statut, stade, prochaine_revision, rappels_actifs"),
    client
      .from("tentatives")
      .select("correct, aide_utilisee, created_at, exercice_versions(exercices(notion_id))")
      .order("created_at", { ascending: false })
      .limit(400),
    client
      .from("agenda_evenements")
      .select("teaching_space_id, chapter_id, debut")
      .eq("kind", "controle")
      .gte("debut", maintenant.toISOString())
      .lte("debut", new Date(maintenant.getTime() + 21 * JOUR).toISOString()),
    client.from("exercices").select("id, notion_id, exercice_versions(id, version, published_at)").is("archived_at", null).limit(400),
  ]);

  const parNotion = new Map<string, { correct: boolean; usedHint: boolean }[]>();
  for (const t of (tentatives.data ?? []) as unknown as {
    correct: boolean | null;
    aide_utilisee: boolean;
    exercice_versions: { exercices: { notion_id: string | null } | null } | null;
  }[]) {
    const notion = t.exercice_versions?.exercices?.notion_id;
    if (!notion || t.correct === null) continue;
    const liste = parNotion.get(notion) ?? [];
    // Les tentatives arrivent de la plus récente à la plus ancienne.
    liste.unshift({ correct: t.correct, usedHint: t.aide_utilisee });
    parNotion.set(notion, liste);
  }

  const etatsParNotion = new Map(
    ((etats.data ?? []) as { notion_id: string; statut: string; prochaine_revision: string | null; rappels_actifs: boolean }[]).map((e) => [e.notion_id, e]),
  );

  const versionsParNotion = new Map<string, string[]>();
  for (const e of (exercices.data ?? []) as unknown as {
    notion_id: string | null;
    exercice_versions: { id: string; version: number; published_at: string | null }[];
  }[]) {
    if (!e.notion_id) continue;
    const derniere = [...(e.exercice_versions ?? [])].filter((v) => v.published_at).sort((a, b) => b.version - a.version)[0];
    if (!derniere) continue;
    versionsParNotion.set(e.notion_id, [...(versionsParNotion.get(e.notion_id) ?? []), derniere.id]);
  }

  const controlesLus = (controles.data ?? []) as { teaching_space_id: string | null; chapter_id: string | null; debut: string }[];
  const objectif = new Set(options.objectif ?? []);

  const suggestions: Suggestion[] = [];
  for (const n of (notions.data ?? []) as unknown as LigneNotion[]) {
    const versions = versionsParNotion.get(n.id) ?? [];
    if (versions.length === 0) continue; // rien à proposer sans exercice publié
    const etat = etatsParNotion.get(n.id);
    if (etat?.statut === "consolide" || etat?.rappels_actifs === false) continue;

    const controle = controlesLus
      .filter((c) => c.teaching_space_id === n.teaching_space_id && (c.chapter_id === null || c.chapter_id === n.chapter_id))
      .map((c) => joursEntre(maintenant, new Date(c.debut)))
      .sort((a, b) => a - b)[0];
    const echeance = etat?.prochaine_revision ? new Date(`${etat.prochaine_revision}T00:00:00`) : null;
    const retard = echeance === null ? 0 : Math.max(0, joursEntre(echeance, maintenant));
    const recentes = parNotion.get(n.id) ?? [];
    const p = revisionPriority({
      daysUntilExam: controle ?? null,
      recentAttempts: recentes,
      daysOverdue: retard,
      inChosenGoal: objectif.has(n.id),
    });
    const aRevoir = recentes.slice(-5).filter((a) => !a.correct || a.usedHint).length;

    suggestions.push({
      notionId: n.id,
      notion: n.label,
      cours: n.teaching_spaces?.subjects?.label ?? null,
      statut: etat?.statut ?? "a_decouvrir",
      score: p.score,
      prochaine: etat?.prochaine_revision ?? null,
      versions,
      explication: expliquerPriorite({
        joursAvantControle: controle ?? null,
        reponsesARevoir: aRevoir,
        joursDeRetard: retard,
        dansObjectif: objectif.has(n.id),
        sansDonnees: !p.hasEvidence,
      }),
    });
  }

  // À score égal, on alterne les notions plutôt que de répéter la même.
  suggestions.sort((a, b) => b.score - a.score || a.notion.localeCompare(b.notion, "fr"));
  return { suggestions: suggestions.slice(0, options.limite ?? 5), parametres: VERSION_PARAMETRES };
}

export const LIBELLE_STATUT: Record<string, string> = {
  inconnu: "Inconnue",
  a_decouvrir: "À découvrir",
  en_cours: "En cours",
  a_revoir: "À revoir",
  consolide: "Consolidée",
};
