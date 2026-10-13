import assert from "node:assert/strict";
import test from "node:test";
import { nomsVoisins } from "../../src/lib/noms-voisins.ts";

/** GR-14 — noms de groupe trompeusement proches. */

test("NV-01 — casse, accents, espaces, ponctuation : voisins", () => {
  assert.equal(nomsVoisins("Spé Maths A", "spe  maths a"), true);
  assert.equal(nomsVoisins("Anglais-B", "Anglais B"), true);
});

test("NV-02 — une faute de frappe : voisins", () => {
  assert.equal(nomsVoisins("Spé Physique", "Spé Phyisque"), false, "deux lettres inversées : distance 2, non signalé");
  assert.equal(nomsVoisins("Spé Physique", "Spé Physiqe"), true);
  assert.equal(nomsVoisins("Latin débutant", "Latin debutants"), true);
});

test("NV-03 — une série voulue n'est pas signalée", () => {
  assert.equal(nomsVoisins("Spé Maths A", "Spé Maths B"), false);
  assert.equal(nomsVoisins("2nde 1 — TP 1", "2nde 1 — TP 2"), false);
  assert.equal(nomsVoisins("Anglais", "Allemand"), false);
});
