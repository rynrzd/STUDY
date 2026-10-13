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

// IMP-11 : les cas qui se lisaient mal disent maintenant pourquoi.
import { classeurBrut } from "../../scripts/recette/xlsx.mjs";

const entete = `<row r="1"><c r="A1" t="inlineStr"><is><t>Nom</t></is></c><c r="B1" t="inlineStr"><is><t>Classe</t></is></c></row>`;

test("xlsx — cellules fusionnées : refus explicite qui nomme la plage", () => {
  const fichier = classeurBrut(
    entete + `<row r="2"><c r="A2" t="inlineStr"><is><t>Durand</t></is></c><c r="B2" t="inlineStr"><is><t>2nde 1</t></is></c></row>`,
    `<mergeCells count="1"><mergeCell ref="B2:B9"/></mergeCells>`,
  );
  assert.throws(() => lireXlsx(fichier), /fusionnées \(B2:B9\)/);
});

test("xlsx — formule jamais calculée ou en erreur : la cellule est nommée", () => {
  const sansValeur = classeurBrut(entete + `<row r="2"><c r="A2" t="inlineStr"><is><t>Durand</t></is></c><c r="B2"><f>CONCAT("2nde ",1)</f></c></row>`);
  assert.throws(() => lireXlsx(sansValeur), /B2 contient une formule jamais calculée/);
  const enErreur = classeurBrut(entete + `<row r="2"><c r="A2" t="inlineStr"><is><t>Durand</t></is></c><c r="B2" t="e"><f>Feuil2!A1</f><v>#REF!</v></c></row>`);
  assert.throws(() => lireXlsx(enErreur), /B2 contient une erreur de formule \(#REF!\)/);
  const calculee = classeurBrut(entete + `<row r="2"><c r="A2" t="inlineStr"><is><t>Durand</t></is></c><c r="B2" t="str"><f>CONCAT("2nde ",1)</f><v>2nde 1</v></c></row>`);
  assert.deepEqual(lireXlsx(calculee).lignes[0], ["Durand", "2nde 1"], "une formule calculée garde sa valeur");
});

test("xlsx — feuille vide et classeur protégé : messages explicites", () => {
  assert.throws(() => lireXlsx(classeurBrut("")), /feuille du classeur est vide/);
  const ole = Buffer.concat([Buffer.from([0xd0, 0xcf, 0x11, 0xe0, 0xa1, 0xb1, 0x1a, 0xe1]), Buffer.alloc(512)]);
  assert.throws(() => lireTableur("eleves.xlsx", ole), /protégé par un mot de passe/);
});
