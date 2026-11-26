import test from "node:test";
import assert from "node:assert/strict";
import { reprendreRevision } from "../../src/lib/revision/reprise.ts";

const questions = [
  { versionId: "cinema", tentativeId: "essai", reponse: { index: 0 } },
  { versionId: "atelier", tentativeId: null, reponse: null },
];

test("La reprise conserve la correction et la réponse zéro après validation", () => {
  const reprise = reprendreRevision(questions, 0);
  assert.equal(reprise.index, 0);
  assert.equal(reprise.reponses.cinema, "0");
  assert.equal(reprise.terminee, false);
});

test("Suivant ouvre la deuxième tâche et la fin reste stable", () => {
  assert.equal(reprendreRevision(questions, 1).index, 1);
  assert.equal(reprendreRevision(questions, 2).terminee, true);
  assert.equal(reprendreRevision(questions).index, 1);
});

test("Un curseur invalide ne masque pas une question", () => {
  for (const position of [-1, 3, 0.5, NaN]) {
    assert.throws(() => reprendreRevision(questions, position), /POSITION_REVISION_INVALIDE/);
  }
});
