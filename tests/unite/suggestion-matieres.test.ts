import { test } from "node:test";
import assert from "node:assert/strict";
import { suggererMatiere, suggererMatieres } from "../../src/lib/suggestion-matieres.ts";

const EXISTANTES = ["Mathématiques", "Sciences de la vie et de la Terre", "Histoire-Géographie", "Anglais", "Physique-Chimie"];

test("IMP-17 — une matière déjà créée est reconnue aux accents et à la casse près", () => {
  assert.deepEqual(suggererMatiere("mathematiques", EXISTANTES), { etat: "reconnue", matiere: "mathematiques", existante: "Mathématiques" });
});

test("IMP-17 — abréviations et fautes de frappe : une suggestion, jamais un remplacement", () => {
  assert.equal(suggererMatiere("Maths", EXISTANTES).etat, "suggestion");
  assert.equal((suggererMatiere("SVT", EXISTANTES) as { existante: string }).existante, "Sciences de la vie et de la Terre");
  assert.equal((suggererMatiere("HG", EXISTANTES) as { existante: string }).existante, "Histoire-Géographie");
  assert.equal((suggererMatiere("LV1 Anglais", EXISTANTES) as { existante: string }).existante, "Anglais");
  assert.equal((suggererMatiere("Physique Chimie", EXISTANTES) as { existante: string }).existante, "Physique-Chimie");
  assert.equal((suggererMatiere("Mathématique", EXISTANTES) as { existante: string }).existante, "Mathématiques");
});

test("IMP-17 — une matière inconnue est annoncée comme nouvelle ; une seule entrée par matière", () => {
  assert.deepEqual(suggererMatiere("Latin", EXISTANTES), { etat: "nouvelle", matiere: "Latin" });
  const liste = suggererMatieres(["Maths", "maths", "Latin", "MATHS "], EXISTANTES);
  assert.equal(liste.length, 2);
});
