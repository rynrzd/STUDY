import assert from "node:assert/strict";
import test from "node:test";
import { analyserFichier, analyserFichierProfesseurs, reconnaitreColonnes } from "../../src/lib/assistant-rentree.ts";
import type { Tableau } from "../../src/lib/tableur.ts";

/**
 * Étape « Vérifier les colonnes » de l'import — cahier des charges ch. 17
 * (parcours, étape 2 ; IMP-10). Des intitulés que la reconnaissance ne
 * comprend pas ne doivent pas obliger à retoucher le fichier : la
 * correspondance choisie à l'écran s'applique telle quelle.
 */

const fichier: Tableau = {
  entetes: ["Apprenant", "Petit nom", "Div."],
  lignes: [
    ["Martin", "Lina", "1ere G2"],
    ["Bernard", "Noah", "1ere G3"],
  ],
};

test("COL-01 — intitulés inconnus : visibles, et une devinette marquée « à confirmer », jamais imposée", () => {
  const colonnes = reconnaitreColonnes(fichier, ["nom", "prenom", "classe", "email", "identifiantExterne"]);
  assert.deepEqual(colonnes.map((c) => c.confiance), ["non_reconnu", "a_confirmer", "non_reconnu"]);
  // « Petit nom » ressemble à « nom » : c'est faux, d'où l'étape de vérification.
  assert.equal(colonnes[1]?.champ, "nom");
  assert.equal(colonnes[0]?.exemple, "Martin", "un exemple pour juger sur pièce");
});

test("COL-02 — la correspondance choisie à l'écran s'applique, sans retoucher le fichier", () => {
  const sans = analyserFichier({ nom: "eleves.csv", octets: 100, tableau: fichier });
  assert.ok(sans.lignes.every((l) => l.anomalies.some((a) => a.gravite === "bloquante")), "sans correspondance : rien d'utilisable");

  const avec = analyserFichier({ nom: "eleves.csv", octets: 100, tableau: fichier, correspondance: { nom: 0, prenom: 1, classe: 2 } });
  assert.deepEqual(
    avec.lignes.map((l) => [l.nom, l.prenom, l.classe]),
    [
      ["Martin", "Lina", "1ere G2"],
      ["Bernard", "Noah", "1ere G3"],
    ],
  );
  assert.ok(avec.lignes.every((l) => !l.anomalies.some((a) => a.gravite === "bloquante")));
});

test("COL-03 — « Ne pas utiliser » une colonne : elle n'est pas lue", () => {
  const t: Tableau = { entetes: ["Nom", "Prénom", "Classe", "Remarque"], lignes: [["Martin", "Lina", "1ere G2", "allergie"]] };
  const r = analyserFichier({ nom: "x.csv", octets: 10, tableau: t, correspondance: { nom: 0, prenom: 1, classe: 2 } });
  assert.ok(!JSON.stringify(r.lignes).includes("allergie"));
});

test("COL-04 — professeurs : même mécanisme", () => {
  const t: Tableau = { entetes: ["Enseignant", "Prénom usuel", "Discipline enseignée"], lignes: [["Dupont", "Claire", "Mathématiques"]] };
  const r = analyserFichierProfesseurs({ nom: "profs.csv", octets: 10, tableau: t, correspondance: { nom: 0, prenom: 1, matieres: 2 } });
  assert.equal(r.lignes[0]?.nom, "Dupont");
  assert.equal(r.lignes[0]?.prenom, "Claire");
});
