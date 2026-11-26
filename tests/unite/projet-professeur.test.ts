import assert from "node:assert/strict";
import test from "node:test";
import {
  classerEnseignements, dedoublonnerEnseignements, projetDepuisMetadonnees, schemaProjetProfesseur,
} from "../../src/lib/projet-professeur.ts";

test("le questionnaire accepte plusieurs classes et matières avec un lycée facultatif", () => {
  const projet = schemaProjetProfesseur.parse({
    etablissement: " Lycée Raoul-Follereau ",
    enseignements: [
      { classe: " Première générale ", matiere: " Français " },
      { classe: "Terminale STI2D", matiere: "Mathématiques" },
      { classe: "Première générale", matiere: "Histoire" },
    ],
  });
  assert.equal(projet.etablissement, "Lycée Raoul-Follereau");
  assert.equal(projet.enseignements.length, 3);
  assert.equal(projet.enseignements[0]?.classe, "Première générale");
});

test("les doublons sont ignorés mais une deuxième matière pour la même classe est conservée", () => {
  const liste = dedoublonnerEnseignements([
    { classe: "Première générale", matiere: "Français" },
    { classe: "PREMIERE generale", matiere: "FRANCAIS" },
    { classe: "Première générale", matiere: "Histoire" },
  ]);
  assert.equal(liste.length, 2);
});

test("les propositions différencient les enseignements déjà créés de ceux à créer", () => {
  const souhaits = [
    { classe: "Première générale", matiere: "Français" },
    { classe: "Première générale", matiere: "Histoire" },
    { classe: "Terminale STI2D", matiere: "Maths" },
  ];
  const resultat = classerEnseignements(souhaits, [
    { label: "Première générale", matieres: ["Français"] },
  ]);
  assert.equal(resultat.dejaCrees.length, 1);
  assert.equal(resultat.aCreer.length, 2);
});

test("les métadonnées non fiables ne provoquent aucune création ni élévation de droits", () => {
  assert.deepEqual(projetDepuisMetadonnees({
    etablissement_enseigne_avecstudy: "Lycée X",
    enseignements_souhaites_avecstudy: [{ classe: "a", matiere: "Maths" }],
    roles: ["admin_etablissement"],
  }), { etablissement: "", enseignements: [] });
  assert.equal(projetDepuisMetadonnees({ roles: ["admin"] }).enseignements.length, 0);
});
