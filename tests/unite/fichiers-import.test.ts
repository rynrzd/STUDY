import assert from "node:assert/strict";
import test from "node:test";
import { MODELES, cellule, csvErreursEleves, csvErreursProfesseurs } from "../../src/lib/fichiers-import.ts";

/** IMP-14 — modèles et fichier des lignes à corriger. */

test("FIC-01 — une cellule qui ressemble à une formule est désamorcée", () => {
  assert.equal(cellule("=HYPERLINK(\"x\")"), `"'=HYPERLINK(""x"")"`);
  assert.equal(cellule("+33 6"), `"'+33 6"`);
  assert.equal(cellule("@moi"), `"'@moi"`);
  assert.equal(cellule("Martin"), `"Martin"`);
});

test("FIC-02 — seules les lignes à corriger partent, avec leur motif, en UTF-8 lisible par Excel", () => {
  const sortie = csvErreursEleves([
    { numero: 2, fichier: "2nde1.csv", prenom: "Lina", nom: "Martin", classe: "2nde 1", identifiantExterne: "E1", etat: "valide", probleme: null },
    { numero: 3, fichier: "2nde1.csv", prenom: "", nom: "Bernard", classe: "2nde 1", identifiantExterne: null, etat: "a_corriger", probleme: "Prénom manquant" },
    { numero: 4, fichier: "2nde1.csv", prenom: "Noah", nom: "Petit", classe: "2nde 1", identifiantExterne: null, etat: "ignoree", probleme: null },
  ]);
  assert.ok(sortie.startsWith("﻿"), "BOM pour les accents dans Excel");
  const lignes = sortie.trim().split("\r\n");
  assert.equal(lignes.length, 2, "l'en-tête et la seule ligne à corriger");
  assert.match(lignes[1]!, /Prénom manquant/);
  assert.ok(!sortie.includes("Lina"), "une ligne valide ne part pas");
});

test("FIC-03 — professeurs : affectations lisibles, aucune donnée de connexion", () => {
  const sortie = csvErreursProfesseurs([
    { numero: 5, fichier: "profs.xlsx", prenom: "Claire", nom: "Dupont", email: null, affectations: [{ matiere: "Maths", classe: "2nde 9" }], valide: false, probleme: "Classe inconnue : 2nde 9" },
  ]);
  assert.match(sortie, /Maths : 2nde 9/);
  assert.ok(!/mot de passe|password/i.test(sortie));
});

test("FIC-04 — les modèles portent les colonnes reconnues par l'import", () => {
  for (const col of ["prenom", "nom", "classe"]) assert.ok(MODELES.eleves.contenu.includes(`"${col}"`), col);
  for (const col of ["prenom", "nom", "matieres", "classes"]) assert.ok(MODELES.professeurs.contenu.includes(`"${col}"`), col);
});
