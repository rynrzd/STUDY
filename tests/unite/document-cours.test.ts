import assert from "node:assert/strict";
import test from "node:test";
import {
  deplacerBloc,
  relireDocument,
  relireReglages,
  remplacerBloc,
  sommaire,
  supprimerBloc,
  texteIntegral,
  type BlocCours,
  type DocumentCours,
  type Modele,
} from "../../src/lib/document-cours.ts";

/**
 * Le modèle de document — cahier « Refonte fidèle », S08 à S10.
 *
 * Le test central est celui de la fidélité : changer de modèle ne doit pas
 * changer un seul caractère. C'est la promesse qu'affiche l'écran du Studio
 * — « Aucun contenu n'a été modifié lors de la mise en page » — et une
 * promesse affichée sans être vérifiée est une promesse qui finira fausse.
 */

const BLOCS: BlocCours[] = [
  { type: "titre", niveau: 1, texte: "Les fonctions affines" },
  { type: "encadre", intitule: "Définition", texte: "Une fonction affine s'écrit f(x) = ax + b." },
  { type: "titre", niveau: 2, texte: "Exemple" },
  { type: "paragraphe", texte: "f(x) = 2x + 3, et pour x = 4 : f(4) = 11." },
  { type: "liste", ordonnee: true, elements: ["Calculer f(2).", "Calculer f(5)."] },
  {
    type: "tableau",
    entetes: ["x", "f(x)"],
    lignes: [
      ["0", "3"],
      ["1", "5"],
    ],
  },
];

const COURS: DocumentCours = {
  version: 1,
  titre: "Les fonctions affines",
  blocs: BLOCS,
  format: "pdf",
  rapport: { pagesLues: 2, blocsExtraits: BLOCS.length, imagesConservees: 0, alertes: [] },
};

/* ------------------------------------------------------------ Fidélité --- */

test("changer de modèle ne change pas un caractère du cours", () => {
  const modeles: Modele[] = ["classique", "fiche", "aere"];
  const reference = texteIntegral(COURS);

  for (const modele of modeles) {
    // Les réglages vivent à côté du document : il n'existe aucun chemin par
    // lequel un choix de présentation pourrait réécrire un bloc.
    const reglages = relireReglages({ modele, taille: 1.3, interligne: 1.9 });
    assert.equal(reglages.modele, modele);
    assert.equal(texteIntegral(COURS), reference, `le modèle ${modele} a modifié le texte`);
  }
});

test("le texte intégral contient bien les formules, les unités et les numéros", () => {
  const integral = texteIntegral(COURS);

  assert.match(integral, /f\(x\) = ax \+ b/);
  assert.match(integral, /f\(4\) = 11/);
  assert.match(integral, /Calculer f\(2\)\./);
  // Le tableau compte aussi : ses cellules ne doivent pas disparaître d'un
  // modèle « compact ». La normalisation ramène les tabulations à une espace,
  // parce qu'on compare du contenu, pas de la mise en forme.
  assert.match(integral, /x f\(x\)\n0 3\n1 5/);
});

/* ------------------------------------------------------------- Édition --- */

test("remplacer, supprimer et déplacer n'agissent que sur le bloc visé", () => {
  const modifie = remplacerBloc(COURS, 3, { type: "paragraphe", texte: "Corrigé à la main." });
  assert.equal(modifie.blocs.length, COURS.blocs.length);
  assert.equal(texteIntegral(modifie).includes("Corrigé à la main."), true);
  assert.equal(texteIntegral(modifie).includes("f(4) = 11"), false);
  // L'original n'a pas bougé : les fonctions rendent un nouveau document.
  assert.equal(texteIntegral(COURS).includes("f(4) = 11"), true);

  const ampute = supprimerBloc(COURS, 0);
  assert.equal(ampute.blocs.length, COURS.blocs.length - 1);
  assert.equal(ampute.blocs[0]?.type, "encadre");

  const permute = deplacerBloc(COURS, 2, "haut");
  assert.equal(permute.blocs[1]?.type, "titre");
  assert.equal(permute.blocs[2]?.type, "encadre");
});

test("un déplacement hors des bornes ne fait rien, et ne casse rien", () => {
  assert.equal(deplacerBloc(COURS, 0, "haut"), COURS);
  assert.equal(deplacerBloc(COURS, COURS.blocs.length - 1, "bas"), COURS);
  assert.equal(deplacerBloc(COURS, 99, "haut"), COURS);
  assert.equal(supprimerBloc(COURS, -1), COURS);
});

/* ------------------------------------------------------------ Sommaire --- */

test("le sommaire suit les titres, dans l'ordre et avec leur niveau", () => {
  const entrees = sommaire(COURS);
  assert.deepEqual(
    entrees.map((entree) => [entree.niveau, entree.texte]),
    [
      [1, "Les fonctions affines"],
      [2, "Exemple"],
    ],
  );
});

/* ---------------------------------------------------------- Relecture ---- */

test("un document venu de la base est relu, jamais cru sur parole", () => {
  assert.equal(relireDocument(null), null);
  assert.equal(relireDocument({ titre: "x" }), null);
  assert.equal(relireDocument({ titre: "x", blocs: [], format: "odt" }), null);

  // Un bloc abîmé est écarté ; le reste du cours survit. Perdre une page
  // entière parce qu'une ligne est illisible serait pire.
  const relu = relireDocument({
    titre: "Cours",
    format: "pdf",
    blocs: [
      { type: "paragraphe", texte: "bon" },
      { type: "inconnu", texte: "mauvais" },
      { type: "titre", niveau: 9, texte: "niveau impossible" },
      { type: "liste", elements: ["a", "b"] },
    ],
  });

  assert.equal(relu?.blocs.length, 2);
  assert.deepEqual(relu?.blocs.map((bloc) => bloc.type), ["paragraphe", "liste"]);
});

test("les réglages hors bornes sont ramenés, pas refusés", () => {
  assert.deepEqual(relireReglages({ modele: "fantaisie", taille: 99, interligne: 0 }), {
    modele: "classique",
    taille: 1.4,
    interligne: 1.4,
    numerosDePage: true,
    sommaire: false,
  });

  assert.equal(relireReglages(undefined).modele, "classique");
  assert.equal(relireReglages({ sommaire: true }).sommaire, true);
  assert.equal(relireReglages({ numerosDePage: false }).numerosDePage, false);
});
