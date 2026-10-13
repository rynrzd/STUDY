import assert from "node:assert/strict";
import test from "node:test";
import { lireGroupes } from "../../src/lib/import-groupes.ts";

/** IMP-05 — lecture d'un fichier de groupes, dans les deux formes admises. */

test("IG-01 — une ligne par appartenance, colonnes dans le désordre et accentuées", () => {
  const r = lireGroupes({
    entetes: ["Élève", "Matière", "Groupe", "Professeur"],
    lignes: [
      ["lina.martin", "Anglais", "Anglais B", "claire.dupont"],
      ["", "", "", ""],
      ["noah.bernard", "Anglais", "Anglais B", "claire.dupont"],
    ],
  });
  assert.equal(r.erreur, null);
  assert.deepEqual(r.lignes.map((l) => [l.groupe, l.eleve, l.matiere, l.professeur]), [
    ["Anglais B", "lina.martin", "Anglais", "claire.dupont"],
    ["Anglais B", "noah.bernard", "Anglais", "claire.dupont"],
  ]);
});

test("IG-02 — la forme du cahier : une cellule « groupes » séparée par |", () => {
  const r = lireGroupes({
    entetes: ["external_id", "prenom", "nom", "classe_principale", "groupes"],
    lignes: [
      ["E123", "Lina", "Martin", "1ere G2", "Spé Maths A|Anglais B"],
      ["E124", "Noah", "Bernard", "1ere G3", "Spé Maths A"],
    ],
  });
  assert.equal(r.erreur, null);
  assert.deepEqual(r.lignes.map((l) => [l.groupe, l.eleve]), [
    ["Spé Maths A", "E123"],
    ["Anglais B", "E123"],
    ["Spé Maths A", "E124"],
  ]);
});

test("IG-03 — sans colonne de groupe : refus expliqué, rien d'inventé", () => {
  const r = lireGroupes({ entetes: ["nom", "prenom"], lignes: [["Martin", "Lina"]] });
  assert.match(r.erreur ?? "", /groupe/);
  assert.equal(r.lignes.length, 0);
});

test("IG-04 — une ligne sans groupe est transmise, pour être rejetée avec son numéro", () => {
  const r = lireGroupes({ entetes: ["groupe", "eleve"], lignes: [["", "lina.martin"]] });
  assert.equal(r.lignes.length, 1);
  assert.equal(r.lignes[0]?.groupe, "");
});
