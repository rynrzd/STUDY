import assert from "node:assert/strict";
import test from "node:test";
import { entrainementsParMatiere } from "../../src/lib/revision/entrainements-matieres.ts";
import type { RevisionDevoir } from "../../src/lib/revision/devoirs.ts";
import type { Suggestion } from "../../src/lib/v6/revision.ts";

const suggestion = (espaceId: string, notion: string, versions: string[]): Suggestion => ({
  notionId: notion, notion, cours: "Français", espaceId, statut: "a_revoir", score: 1,
  explication: "À revoir", prochaine: null, versions,
});
const devoir = (espace_id: string, notion: string, versions: string[]): RevisionDevoir => ({
  devoir_id: notion, titre: "À rendre", echeance: null, notion_id: notion,
  notion, espace_id, versions,
});

test("réviser une matière : priorité au devoir, sans mélanger les cours", () => {
  const matieres = [{ id: "fr", libelle: "Français" }, { id: "maths", libelle: "Mathématiques" }];
  const resultat = entrainementsParMatiere(matieres,
    [suggestion("fr", "Métaphore", ["F1", "F2"]), suggestion("maths", "Fonctions", ["M1"])],
    [devoir("fr", "Argumentation", ["D1", "D2"])],
  );
  assert.deepEqual(resultat[0]?.versions, ["D1", "D2", "F1", "F2"]);
  assert.deepEqual(resultat[1]?.versions, ["M1"]);
  assert.deepEqual(resultat[0]?.notions, ["Argumentation", "Métaphore"]);
});

test("réviser une matière : dédupliquer, limiter à huit et garder les matières vides", () => {
  const resultat = entrainementsParMatiere(
    [{ id: "a", libelle: "A" }, { id: "b", libelle: "B" }],
    [suggestion("a", "N1", ["v1", "v2", "v3"]), suggestion("a", "N2", ["v1", "v4"])],
    [devoir("a", "N1", ["v1", "v2", "v5", "v6", "v7", "v8", "v9", "v10"])],
  );
  assert.equal(resultat[0]?.versions.length, 8);
  assert.equal(new Set(resultat[0]?.versions).size, 8);
  assert.deepEqual(resultat[1]?.versions, []);
  assert.equal(resultat[1]?.devoirs, 0);
});
