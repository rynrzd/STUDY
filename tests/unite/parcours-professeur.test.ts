import assert from "node:assert/strict";
import test from "node:test";
import { etatParcoursProfesseur } from "../../src/lib/parcours-professeur.ts";

test("première visite : on propose de créer une classe, jamais une séance inaccessible", () => {
  const etat = etatParcoursProfesseur(0, 0, 0);
  assert.equal(etat.progression, 0);
  assert.equal(etat.action.href, "/professeur/classes");
});

test("classe créée : la prochaine action est le brouillon", () => {
  const etat = etatParcoursProfesseur(2, 0, 0);
  assert.equal(etat.progression, 1);
  assert.match(etat.action.libelle, /séance/);
});

test("séance encore en brouillon : ne pas la présenter comme publiée", () => {
  const etat = etatParcoursProfesseur(1, 3, 0);
  assert.equal(etat.progression, 2);
  assert.match(etat.action.libelle, /publier/);
});

test("cours publié : proposer les invitations et ne pas les compter à tort", () => {
  const etat = etatParcoursProfesseur(1, 2, 1);
  assert.equal(etat.progression, 3);
  assert.match(etat.action.libelle, /Inviter/);
});

test("données incohérentes : aucune publication sans classe ni séance", () => {
  const etat = etatParcoursProfesseur(0, 0, 4);
  assert.equal(etat.progression, 0);
});
