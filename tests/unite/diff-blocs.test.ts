import assert from "node:assert/strict";
import test from "node:test";
import { comparerBlocs, resumeDifferences } from "../../src/lib/diff-blocs.ts";

/** PUB-11 — différences depuis la version publiée. */

const t = (position: number, texte: string) => ({ kind: "texte", position, contenu: { texte } });

test("DIF-01 — rien n'a changé", () => {
  const d = comparerBlocs([t(1, "a"), t(2, "b")], [t(1, "a"), t(2, "b")]);
  assert.deepEqual(d, { ajoutes: 0, modifies: 0, retires: 0, deplaces: false });
  assert.equal(resumeDifferences(d), "Aucune modification depuis la publication.");
});

test("DIF-02 — modifié, ajouté, retiré", () => {
  const d = comparerBlocs([t(1, "a"), t(2, "b"), t(3, "c")], [t(1, "a"), t(2, "B !"), t(4, "d")]);
  assert.equal(d.modifies, 1);
  assert.equal(d.ajoutes, 1);
  assert.equal(d.retires, 1);
  assert.match(resumeDifferences(d), /1 bloc modifié, 1 ajouté, 1 retiré/);
});

test("DIF-03 — mêmes blocs, autre ordre", () => {
  const d = comparerBlocs([t(1, "a"), t(2, "b")], [t(1, "b"), t(2, "a")]);
  assert.deepEqual(d, { ajoutes: 0, modifies: 0, retires: 0, deplaces: true });
});
