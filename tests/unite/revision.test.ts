import assert from "node:assert/strict";
import test from "node:test";
import {
  expliquerPriorite,
  isConsolidated,
  nextReview,
  reciprocalRankFusion,
  revisionPriority,
} from "../../src/lib/revision/algorithmes.ts";
import { assembler, compterMots, premierePhrase, type SourceAssemblage } from "../../src/lib/revision/assemblage.ts";

/**
 * Les onze assertions de référence du dossier (algorithms.test.mjs), rejouées
 * sur le portage TypeScript : le code du produit doit dire exactement la même
 * chose que la référence remise au développeur.
 */
test("references du dossier : priorite, ordonnanceur, consolidation, fusion", () => {
  assert.equal(revisionPriority({ daysUntilExam: -1 }).components.urgency, 0);
  assert.equal(revisionPriority({}).hasEvidence, false);
  assert.equal(revisionPriority({ recentAttempts: [{ correct: true, usedHint: true }] }).components.fragility, 1);
  assert.deepEqual(nextReview({ stage: 3, correct: false, usedHint: false }), { stage: 0, inDays: 1 });
  assert.deepEqual(nextReview({ stage: 3, correct: true, usedHint: true }), { stage: 3, inDays: 1 });
  assert.deepEqual(nextReview({ stage: 4, correct: true, usedHint: false }), { stage: 4, inDays: 30 });
  assert.equal(isConsolidated([{ correct: true, usedHint: false, dayKey: "2026-10-05", exerciseVersionId: "a" }]), false);
  assert.equal(
    isConsolidated([
      { correct: true, dayKey: "2026-10-05", exerciseVersionId: "a" },
      { correct: true, dayKey: "2026-10-06", exerciseVersionId: "b" },
      { correct: true, dayKey: "2026-10-06", exerciseVersionId: "a" },
    ]),
    true,
  );
  assert.deepEqual(reciprocalRankFusion([], []), []);
  assert.equal(reciprocalRankFusion(["a", "b"], ["b", "c"])[0]!.id, "b");
  assert.equal(reciprocalRankFusion(["a", "a"], []).length, 1);
});

test("priorite : bornes, absence de donnees, controle passe", () => {
  const p = revisionPriority({ daysUntilExam: 4, recentAttempts: [{ correct: false }, { correct: true }], daysOverdue: 20, inChosenGoal: true });
  assert.ok(p.score <= 1 && p.score >= 0);
  assert.equal(p.components.overdue, 1);
  assert.equal(revisionPriority({}).components.fragility, 0.5);
  assert.equal(revisionPriority({ daysUntilExam: 30 }).components.urgency, 0);
  assert.throws(() => nextReview({ stage: 5, correct: true, usedHint: false }));
});

test("explication : les faits, jamais le score", () => {
  assert.equal(
    expliquerPriorite({ joursAvantControle: 4, reponsesARevoir: 2, joursDeRetard: 0, dansObjectif: false, sansDonnees: false }),
    "Proposé car contrôle dans 4 jours et 2 réponses à revoir.",
  );
  assert.equal(
    expliquerPriorite({ joursAvantControle: null, reponsesARevoir: 0, joursDeRetard: 0, dansObjectif: false, sansDonnees: true }),
    "Proposé car notion pas encore travaillée.",
  );
  assert.equal(
    expliquerPriorite({ joursAvantControle: 30, reponsesARevoir: 0, joursDeRetard: 0, dansObjectif: false, sansDonnees: false }),
    "Proposé pour entretenir ce que tu as déjà vu.",
  );
});

const seance = (overrides: Partial<SourceAssemblage> = {}): SourceAssemblage => ({
  lessonId: "L1",
  titre: "Images et antécédents",
  lisible: true,
  exercices: ["V1", "V2"],
  passages: [
    { ordre: 1, ref: "doc:1", page: 1, kind: "titre", texte: "1. Image d'un nombre" },
    { ordre: 2, ref: "doc:2", page: 1, kind: "paragraphe", texte: "On dit que f(a) est l'image du nombre a par la fonction f. Elle se lit sur l'axe vertical." },
    { ordre: 3, ref: "doc:3", page: 1, kind: "paragraphe", texte: "Exemple : f(3) = 2 × 3 + 1 = 7. On obtient donc f(3) = 7." },
    { ordre: 4, ref: "doc:4", page: 2, kind: "titre", texte: "2. Antécédent d'un nombre" },
    { ordre: 5, ref: "doc:5", page: 2, kind: "encadre", texte: "Définition : a est un antécédent de b par f lorsque f(a) = b." },
    { ordre: 6, ref: "doc:6", page: 2, kind: "paragraphe", texte: "Attention : un nombre peut avoir plusieurs antécédents." },
    { ordre: 7, ref: "doc:7", page: 2, kind: "paragraphe", texte: "Pour déterminer un antécédent, on résout l'équation f(x) = b." },
  ],
  ...overrides,
});

/** Chaque texte de fiche doit se retrouver mot pour mot dans un passage cité. */
function toutEstCite(sources: readonly SourceAssemblage[], textes: readonly { texte: string; citation: { ref: string } }[]) {
  for (const extrait of textes) {
    const passage = sources.flatMap((s) => s.passages).find((p) => p.ref === extrait.citation.ref);
    assert.ok(passage, `citation inconnue ${extrait.citation.ref}`);
    assert.ok(passage.texte.includes(extrait.texte), `« ${extrait.texte} » n'est pas un extrait de ${extrait.citation.ref}`);
  }
}

test("assemblage essentiel : uniquement des extraits cites, notions en tete", () => {
  const sources = [seance()];
  const fiche = assembler({ format: "essentiel", objectif: "essentiel", longueur: "courte", sources });
  assert.equal(fiche.etat, "ready");
  assert.equal(fiche.sections[0]!.role, "notions");
  toutEstCite(sources, fiche.sections.flatMap((s) => s.extraits));
  assert.ok(fiche.sections.some((s) => s.role === "attention"));
  assert.ok(fiche.sections.some((s) => s.role === "methode"));
  // La formule n'est pas coupee au milieu.
  assert.equal(premierePhrase("Exemple : f(3) = 2 × 3 + 1 = 7. On obtient donc f(3) = 7."), "Exemple : f(3) = 2 × 3 + 1 = 7.");
});

test("assemblage : plafond de mots respecte et signale", () => {
  const long = "mot ".repeat(400).trim() + ".";
  const sources = [
    seance({
      passages: [
        { ordre: 1, ref: "a", page: null, kind: "paragraphe", texte: long },
        { ordre: 2, ref: "b", page: null, kind: "paragraphe", texte: long },
      ],
    }),
  ];
  const fiche = assembler({ format: "detaille", objectif: "comprendre", longueur: "detaillee", sources });
  const mots = fiche.sections.flatMap((s) => s.extraits).reduce((n, e) => n + compterMots(e.texte), 0);
  assert.ok(mots <= 1500);
  const courte = assembler({ format: "essentiel", objectif: "comprendre", longueur: "courte", sources });
  assert.ok(courte.limites.some((l) => l.code === "LONGUEUR_ATTEINTE"));
});

test("AI-03 / source illisible : clarification, jamais d'invention", () => {
  const scannee = seance({ lessonId: "L2", titre: "Cours scanné", passages: [{ ordre: 1, ref: "x", page: 1, kind: "image", texte: "" }] });
  const fiche = assembler({ format: "essentiel", objectif: "essentiel", longueur: "courte", sources: [scannee] });
  assert.equal(fiche.etat, "needs_review");
  assert.equal(fiche.sections.length, 0);
  assert.equal(fiche.limites[0]!.code, "SOURCE_SANS_TEXTE");

  // Une source illisible n'empeche pas les autres, et c'est dit.
  const mixte = assembler({ format: "essentiel", objectif: "essentiel", longueur: "courte", sources: [seance(), scannee] });
  assert.equal(mixte.etat, "ready");
  assert.ok(mixte.limites.some((l) => l.lessonId === "L2"));

  const retiree = assembler({ format: "essentiel", objectif: "essentiel", longueur: "courte", sources: [seance({ lisible: false })] });
  assert.equal(retiree.etat, "needs_review");
  assert.equal(retiree.limites[0]!.code, "SOURCE_RETIREE");
});

test("cartes et quiz : fideles, ou une demande de clarification", () => {
  const sources = [seance()];
  const cartes = assembler({ format: "cartes", objectif: "essentiel", longueur: "courte", sources });
  assert.equal(cartes.etat, "ready");
  assert.ok(cartes.cartes.length >= 2);
  for (const c of cartes.cartes) {
    const passage = sources[0]!.passages.find((p) => p.ref === c.citation.ref)!;
    assert.ok(passage.texte.includes(c.verso), "le verso est un extrait du cours");
  }

  const quiz = assembler({ format: "quiz", objectif: "essentiel", longueur: "courte", sources });
  assert.deepEqual(quiz.exercices, ["V1", "V2"]);
  const sansExercice = assembler({ format: "quiz", objectif: "essentiel", longueur: "courte", sources: [seance({ exercices: [] })] });
  assert.equal(sansExercice.etat, "needs_review");
  assert.equal(sansExercice.limites[0]!.code, "PAS_D_EXERCICE");
});

test("preparation d'un controle : questions de verification ancrees dans les titres", () => {
  const fiche = assembler({ format: "controle", objectif: "essentiel", longueur: "courte", sources: [seance()] });
  const verification = fiche.sections.find((s) => s.role === "verification");
  assert.ok(verification);
  assert.match(verification.extraits[0]!.texte, /^Sais-tu expliquer « 1\. Image d'un nombre »/);
  assert.deepEqual(fiche.exercices, ["V1", "V2"]);
});
