import assert from "node:assert/strict";
import test from "node:test";
import { matieres, trouverMatiere } from "../../src/app/(accueil)/matieres.ts";

test("l'accueil propose plusieurs interactions pedagogiques, pas seulement des QCM", () => {
  const exercices = matieres.flatMap((matiere) => matiere.exercices);
  const formats = new Set(exercices.map((exercice) => exercice.format ?? "choix"));
  assert.deepEqual([...formats].sort(), ["choix", "numerique", "ordre"]);

  for (const exercice of exercices) {
    assert.ok(exercice.question.length >= 10);
    assert.ok(exercice.indice.length > 10);
    assert.ok(exercice.explication.length > 10);
    if (exercice.format === "ordre") {
      assert.ok(exercice.mots && exercice.mots.length >= 3);
      assert.equal(exercice.mots.slice().sort().join(" "), exercice.bonneReponse.split(" ").sort().join(" "));
    } else if (exercice.format === "numerique") {
      assert.ok(Number.isFinite(Number(exercice.bonneReponse)));
    } else {
      assert.ok(exercice.choix.length >= 2);
      assert.ok(exercice.choix.includes(exercice.bonneReponse));
    }
  }
});

test("une recherche cible l'exercice numerique et la phrase a reconstituer", () => {
  assert.equal(trouverMatiere("fonctions")?.exercice.format, "numerique");
  assert.equal(trouverMatiere("anglais")?.exercice.format, "ordre");
});
