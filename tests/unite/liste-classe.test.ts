import assert from "node:assert/strict";
import test from "node:test";
import { elevesDepuisTableau } from "../../src/lib/liste-classe.ts";

test("liste de classe — reconnaît nom, prénom et identité externe", () => {
  const lignes = elevesDepuisTableau("STI2D.csv", 100, {
    entetes: ["Nom", "Prénom", "INE"],
    lignes: [["Martin", "Léa", "INE-001"], ["Durand", "Noé", "INE-002"]],
  });
  assert.deepEqual(lignes.map(({ nom, prenom }) => ({ nom, prenom })), [{ nom: "Martin", prenom: "Léa" }, { nom: "Durand", prenom: "Noé" }]);
  assert.match(lignes[0]!.externe, /^[a-f0-9]{64}$/);
});

test("liste de classe — un même fichier produit les mêmes clés et garde les homonymes", () => {
  const tableau = { entetes: ["nom", "prenom"], lignes: [["Dupont", "Camille"], ["Dupont", "Camille"]] };
  const premier = elevesDepuisTableau("liste.csv", 50, tableau);
  const second = elevesDepuisTableau("liste.csv", 50, tableau);
  assert.equal(premier.length, 2);
  assert.notEqual(premier[0]!.externe, premier[1]!.externe);
  assert.deepEqual(premier, second);
});
