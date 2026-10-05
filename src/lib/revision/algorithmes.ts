/**
 * Algorithmes de référence du dossier Study V6 (algorithms.mjs), portés tels
 * quels en TypeScript.
 *
 * Ce sont des **paramètres produit** à évaluer, pas une vérité scientifique
 * sur la mémoire ni une promesse de progrès (§8.3). Ils sont versionnés ici :
 * changer un coefficient est une décision, pas un réglage silencieux.
 *
 * L'ordonnanceur (nextReview, isConsolidated) est appliqué dans la base, par
 * study.revision_tenter, pour rester idempotent dans la même transaction que
 * la tentative. Ces fonctions-ci servent au calcul des priorités, à
 * l'explication affichée et aux tests qui vérifient que la base et le code
 * disent la même chose.
 */

export const VERSION_PARAMETRES = "dossier-2026-10-05";

const borner = (x: number) => Math.max(0, Math.min(1, x));

export interface TentativeResumee {
  readonly correct: boolean;
  readonly usedHint?: boolean;
}

export interface Priorite {
  readonly score: number;
  readonly components: { readonly urgency: number; readonly fragility: number; readonly overdue: number; readonly goal: number };
  readonly hasEvidence: boolean;
}

export function revisionPriority({
  daysUntilExam = null,
  recentAttempts = [],
  daysOverdue = 0,
  inChosenGoal = false,
}: {
  daysUntilExam?: number | null;
  recentAttempts?: readonly TentativeResumee[];
  daysOverdue?: number;
  inChosenGoal?: boolean;
}): Priorite {
  const urgency = daysUntilExam === null || daysUntilExam < 0 ? 0 : borner(1 - daysUntilExam / 14);
  const last = recentAttempts.slice(-5);
  const fragility = last.length ? 1 - last.filter((a) => a.correct && !a.usedHint).length / last.length : 0.5;
  const overdue = borner(daysOverdue / 7);
  const goal = Number(inChosenGoal);
  return {
    score: 0.4 * urgency + 0.35 * fragility + 0.15 * overdue + 0.1 * goal,
    components: { urgency, fragility, overdue, goal },
    hasEvidence: last.length > 0,
  };
}

export function nextReview({ stage = 0, correct, usedHint }: { stage?: number; correct: boolean; usedHint: boolean }) {
  if (!Number.isInteger(stage) || stage < 0 || stage > 4) throw new Error("Invalid review stage");
  if (!correct) return { stage: 0, inDays: 1 };
  if (usedHint) return { stage, inDays: 1 };
  return { stage: Math.min(stage + 1, 4), inDays: [1, 3, 7, 14, 30][stage]! };
}

export function isConsolidated(
  attempts: readonly { correct: boolean; usedHint?: boolean; dayKey: string; exerciseVersionId: string }[],
): boolean {
  // dayKey est calculé côté serveur, dans le fuseau de la personne.
  const successful = attempts.filter((a) => a.correct && !a.usedHint);
  return (
    successful.length >= 3 &&
    new Set(successful.map((a) => a.dayKey)).size >= 2 &&
    new Set(successful.map((a) => a.exerciseVersionId)).size >= 2
  );
}

/**
 * Fusion par rang réciproque (§7.3) : score = 0,55/(60+rang lexical) +
 * 0,45/(60+rang sémantique), rangs à partir de 1, branche absente = 0.
 * Les candidats sont déjà autorisés ; les droits sont revérifiés ensuite.
 */
export function reciprocalRankFusion(lexicalIds: readonly string[], semanticIds: readonly string[]) {
  const scores = new Map<string, number>();
  for (const [ids, weight] of [
    [lexicalIds, 0.55],
    [semanticIds, 0.45],
  ] as const) {
    [...new Set(ids)].forEach((id, index) => scores.set(id, (scores.get(id) ?? 0) + weight / (60 + index + 1)));
  }
  return [...scores]
    .map(([id, score]) => ({ id, score }))
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
}

/**
 * L'explication affichée à l'élève (§8.3 : « proposé car contrôle dans 4
 * jours et deux réponses à revoir »). Elle cite les faits, pas le score.
 */
export function expliquerPriorite(options: {
  readonly joursAvantControle: number | null;
  readonly reponsesARevoir: number;
  readonly joursDeRetard: number;
  readonly dansObjectif: boolean;
  readonly sansDonnees: boolean;
}): string {
  const raisons: string[] = [];
  if (options.joursAvantControle !== null && options.joursAvantControle >= 0 && options.joursAvantControle <= 14) {
    raisons.push(
      options.joursAvantControle === 0
        ? "contrôle aujourd'hui"
        : `contrôle dans ${options.joursAvantControle} jour${options.joursAvantControle > 1 ? "s" : ""}`,
    );
  }
  if (options.reponsesARevoir > 0) {
    raisons.push(`${options.reponsesARevoir === 1 ? "une réponse" : `${options.reponsesARevoir} réponses`} à revoir`);
  }
  if (options.joursDeRetard > 0) {
    raisons.push(`révision prévue il y a ${options.joursDeRetard} jour${options.joursDeRetard > 1 ? "s" : ""}`);
  }
  if (options.dansObjectif) raisons.push("dans l'objectif que tu as choisi");
  if (options.sansDonnees) raisons.push("notion pas encore travaillée");
  if (raisons.length === 0) return "Proposé pour entretenir ce que tu as déjà vu.";
  const derniere = raisons.pop()!;
  return `Proposé car ${raisons.length > 0 ? `${raisons.join(", ")} et ${derniere}` : derniere}.`;
}
