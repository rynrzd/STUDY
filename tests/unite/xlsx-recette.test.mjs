// =============================================================================
// L'écrivain .xlsx de la recette, relu par le lecteur du produit.
//
// C'est le seul test qui compte pour cet outil : ce que la recette écrit doit
// être exactement ce que le produit lit. Un écrivain approximatif produirait
// des échecs d'import qu'on attribuerait au produit — l'outil de mesure
// accuserait ce qu'il mesure.
// =============================================================================

import test from "node:test";
import assert from "node:assert/strict";
import { classeur } from "../../scripts/recette/xlsx.mjs";
import { lireXlsx, lireTableur } from "../../src/lib/tableur.ts";

test("xlsx — ce que la recette ecrit, le produit le relit", () => {
  const tableau = lireXlsx(
    classeur([
      ["Nom", "Prénom", "Classe"],
      ["Durand", "Amélie", "2nde 4"],
      ["Lefèvre", "Bruno", "2nde 4"],
    ]),
  );

  assert.deepEqual(tableau.entetes, ["Nom", "Prénom", "Classe"]);
  assert.equal(tableau.lignes.length, 2);
  assert.deepEqual(tableau.lignes[0], ["Durand", "Amélie", "2nde 4"]);
});

test("xlsx — accents, apostrophes et caracteres XML survivent", () => {
  const tableau = lireXlsx(
    classeur([
      ["Nom", "Prénom"],
      ["O'Connor", "Noël"],
      ["Dupont-Martin", "Léa & Chloé"],
      ["<Balise>", 'Guillemets "doubles"'],
    ]),
  );

  assert.deepEqual(tableau.lignes[0], ["O'Connor", "Noël"]);
  assert.deepEqual(tableau.lignes[1], ["Dupont-Martin", "Léa & Chloé"]);
  assert.deepEqual(tableau.lignes[2], ["<Balise>", 'Guillemets "doubles"']);
});

test("xlsx — une cellule vide reste vide, elle ne decale pas la ligne", () => {
  const tableau = lireXlsx(
    classeur([
      ["Nom", "Prénom", "Classe"],
      ["Durand", "", "2nde 4"],
    ]),
  );

  assert.deepEqual(tableau.lignes[0], ["Durand", "", "2nde 4"]);
});

test("xlsx — le produit reconnait l extension et choisit le bon lecteur", () => {
  const tableau = lireTableur(
    "eleves.xlsx",
    classeur([
      ["Nom", "Prénom"],
      ["Durand", "Amélie"],
    ]),
  );

  assert.deepEqual(tableau.entetes, ["Nom", "Prénom"]);
  assert.equal(tableau.lignes.length, 1);
});
