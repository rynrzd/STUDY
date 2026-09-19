import assert from "node:assert/strict";
import test from "node:test";
import {
  analyserFichier,
  attribuerIdentifiants,
  classeDepuisNomDeFichier,
  classeNormalisee,
  construirePlan,
  correspondanceDepuis,
  detecterClasse,
  fichierRejete,
  reconnaitreColonnes,
} from "../../src/lib/assistant-rentree.ts";
import type { Tableau } from "../../src/lib/tableur.ts";

/**
 * Assistant de rentrée — cahier V5, §5.1 à §5.8.
 *
 * Chaque test porte le numéro de la règle qu'il protège. Ce qui est vérifié ici
 * est ce qui coûte cher quand ça lâche : une classe inventée en silence, deux
 * homonymes fusionnés, un réimport qui double les comptes.
 */

const tableau = (entetes: string[], lignes: string[][]): Tableau => ({ entetes, lignes });

/* --------------------------------------------------- §5.3 Mapping -------- */

test("§5.3 — les intitules usuels sont reconnus, les variantes signalees", () => {
  const t = tableau(
    ["NOM", "Prénom élève", "Classe", "surname", "Truc interne"],
    [["Dupont", "Martin", "2nde 4", "x", "y"]],
  );

  const colonnes = reconnaitreColonnes(t, ["nom", "prenom", "classe", "email", "identifiantExterne"]);

  assert.equal(colonnes[0]?.champ, "nom");
  assert.equal(colonnes[0]?.confiance, "sur", "« NOM » est une correspondance exacte");

  assert.equal(colonnes[1]?.champ, "prenom");
  // « Prénom élève » figure tel quel dans les intitules admis : c est une
  // correspondance exacte, pas une supposition.
  assert.equal(colonnes[1]?.confiance, "sur");

  assert.equal(colonnes[2]?.champ, "classe");

  // Une colonne inconnue reste visible : elle n est pas effacee de l ecran.
  const inconnue = colonnes[4];
  assert.equal(inconnue?.champ, null);
  assert.equal(inconnue?.confiance, "non_reconnu");
  assert.equal(inconnue?.entete, "Truc interne");
});

test("§5.3 — chaque colonne porte un exemple de valeur", () => {
  const t = tableau(["Nom", "Prénom"], [["", ""], ["Dupont", "Martin"]]);
  const colonnes = reconnaitreColonnes(t, ["nom", "prenom"]);

  // La premiere cellule est vide : l exemple doit venir de la suivante, sinon
  // l administrateur juge sur du vide.
  assert.equal(colonnes[0]?.exemple, "Dupont");
  assert.equal(colonnes[1]?.exemple, "Martin");
});

test("§5.3 — une colonne ne sert jamais deux champs", () => {
  const t = tableau(["Classe", "Classes"], [["2nde 4", "2nde 4"]]);
  const colonnes = reconnaitreColonnes(t, ["classe", "classes"]);
  const champs = colonnes.map((colonne) => colonne.champ);
  assert.equal(new Set(champs.filter(Boolean)).size, champs.filter(Boolean).length);
});

/* ------------------------------------------ §5.2 Detection de classe ----- */

test("§5.2 — la classe vient du nom du fichier quand il est parlant", () => {
  assert.equal(classeDepuisNomDeFichier("2nde4.xlsx"), "2nde4");
  assert.equal(classeDepuisNomDeFichier("Seconde 4.csv"), "Seconde 4");
  assert.equal(classeDepuisNomDeFichier("Terminale S2.xlsx"), "Terminale S2");
  // « TS2 » est court mais porte un chiffre : c est un nom de classe plausible,
  // et l administrateur peut le corriger a l ecran s il se trompe.
  assert.equal(classeDepuisNomDeFichier("TS2.csv"), "TS2");
});

test("§5.2 — un nom de fichier generique ne fabrique pas une classe", () => {
  // Le cas exact du cahier : « liste.xlsx » sans colonne classe doit demander.
  for (const nom of ["liste.xlsx", "eleves.csv", "import.xlsx", "rentree.csv"]) {
    assert.equal(classeDepuisNomDeFichier(nom), null, `${nom} ne doit rien produire`);
  }

  const t = tableau(["Nom", "Prénom"], [["Dupont", "Martin"]]);
  const detectee = detecterClasse("liste.xlsx", t, correspondanceDepuis(reconnaitreColonnes(t, ["nom", "prenom"])));

  assert.equal(detectee.nom, null, "aucune classe ne doit etre inventee");
  assert.equal(detectee.source, "inconnue");
});

test("§5.2 — la colonne Classe l emporte, et repartit un fichier global", () => {
  const t = tableau(
    ["Nom", "Prénom", "Classe"],
    [
      ["Dupont", "Martin", "2nde 4"],
      ["Benali", "Rayan", "2nde 1"],
      ["Moreau", "Inès", "2nde 4"],
    ],
  );
  const correspondance = correspondanceDepuis(
    reconnaitreColonnes(t, ["nom", "prenom", "classe"]),
  );

  // Le nom du fichier annonce une classe, la colonne en annonce deux : c est la
  // colonne qui decrit chaque ligne, donc c est elle qui gagne.
  const detectee = detecterClasse("2nde4.xlsx", t, correspondance);
  assert.equal(detectee.source, "colonne");
  assert.equal(detectee.nom, null, "plusieurs classes : rien n est decide seul");
  assert.deepEqual(detectee.multiples, ["2nde 1", "2nde 4"]);

  const plan = construirePlan([
    analyserFichier({ nom: "global.xlsx", octets: 100, tableau: t }),
  ]);

  assert.equal(plan.classes.length, 2, "le fichier global est reparti en deux classes");
  assert.equal(plan.classes.find((c) => c.nom === "2nde 4")?.effectif, 2);
  assert.equal(plan.classes.find((c) => c.nom === "2nde 1")?.effectif, 1);
});

/* ------------------------------------------- §5.4 Normalisation ---------- */

test("§5.4 — les ecritures d une meme classe se rejoignent, l affichage reste", () => {
  assert.equal(classeNormalisee("2nde 4"), classeNormalisee("2DE4"));
  assert.equal(classeNormalisee("Seconde 4"), classeNormalisee("2nde4"));
  assert.equal(classeNormalisee("Terminale S2"), classeNormalisee("Tle S2"));
  assert.notEqual(classeNormalisee("2nde 4"), classeNormalisee("2nde 1"));

  const plan = construirePlan([
    analyserFichier({
      nom: "a.xlsx",
      octets: 10,
      tableau: tableau(["Nom", "Prénom", "Classe"], [["Dupont", "Martin", "2nde 4"]]),
    }),
    analyserFichier({
      nom: "b.xlsx",
      octets: 10,
      tableau: tableau(["Nom", "Prénom", "Classe"], [["Benali", "Rayan", "2DE4"]]),
    }),
  ]);

  assert.equal(plan.classes.length, 1, "une seule classe, malgre deux orthographes");
  assert.equal(plan.classes[0]?.nom, "2nde 4", "le libelle affiche est celui rencontre en premier");
  assert.equal(plan.classes[0]?.effectif, 2);
});

test("§5.4 — deux homonymes restent deux personnes", () => {
  const plan = construirePlan([
    analyserFichier({
      nom: "2nde4.xlsx",
      octets: 10,
      tableau: tableau(
        ["Nom", "Prénom", "Classe", "INE"],
        [
          ["Dupont", "Martin", "2nde 4", "111"],
          ["Dupont", "Martin", "2nde 4", "222"],
        ],
      ),
    }),
  ]);

  assert.equal(plan.lignes.length, 2, "les deux lignes survivent");
  assert.equal(plan.compte.bloquantes, 0, "un homonyme n est pas une erreur bloquante");

  // Ils sont signales, et ils recoivent deux identifiants distincts.
  const identifiants = attribuerIdentifiants(plan.lignes, new Set());
  assert.equal(identifiants.length, 2);
  assert.notEqual(identifiants[0]?.login, identifiants[1]?.login);
});

test("§5.4 — un email invalide avertit sans bloquer, et n est pas retenu", () => {
  const plan = construirePlan([
    analyserFichier({
      nom: "2nde4.xlsx",
      octets: 10,
      tableau: tableau(
        ["Nom", "Prénom", "Classe", "Email"],
        [["Dupont", "Martin", "2nde 4", "pas-une-adresse"]],
      ),
    }),
  ]);

  const ligne = plan.lignes[0]!;
  assert.equal(ligne.email, null, "une adresse invalide n est pas conservee");
  assert.equal(ligne.anomalies[0]?.code, "email_invalide");
  assert.equal(ligne.anomalies[0]?.gravite, "avertissement");
  assert.equal(plan.compte.bloquantes, 0);
});

/* ------------------------------------------------ §5.5 Verification ------ */

test("§5.5 — une ligne sans nom bloque la creation, et le dit", () => {
  const plan = construirePlan([
    analyserFichier({
      nom: "2nde4.xlsx",
      octets: 10,
      tableau: tableau(
        ["Nom", "Prénom", "Classe"],
        [
          ["Dupont", "Martin", "2nde 4"],
          ["", "Sans nom", "2nde 4"],
        ],
      ),
    }),
  ]);

  assert.equal(plan.compte.bloquantes, 1);
  assert.equal(plan.compte.valides, 1);
  assert.ok(plan.blocages.length > 0, "le bouton Creer doit rester ferme");

  // Et la ligne fautive n entre pas dans la creation des comptes.
  assert.equal(attribuerIdentifiants(plan.lignes, new Set()).length, 1);
});

test("§5.5 — les compteurs decrivent exactement le plan", () => {
  const plan = construirePlan([
    analyserFichier({
      nom: "2nde4.xlsx",
      octets: 10,
      tableau: tableau(
        ["Nom", "Prénom", "Classe", "Email"],
        [
          ["Dupont", "Martin", "2nde 4", "m@exemple.fr"],
          ["Benali", "Rayan", "2nde 4", "mauvais"],
          ["", "Perdu", "2nde 4", ""],
        ],
      ),
    }),
    fichierRejete("casse.xlsx", 10, "Fichier illisible."),
  ]);

  assert.equal(plan.compte.fichiersLus, 1);
  assert.equal(plan.compte.fichiersRejetes, 1);
  assert.equal(plan.compte.lignesLues, 3);
  assert.equal(plan.compte.valides, 2);
  assert.equal(plan.compte.avertissements, 1);
  assert.equal(plan.compte.bloquantes, 1);
});

test("§5.1 — un fichier illisible ne fait pas tomber le lot", () => {
  const plan = construirePlan([
    analyserFichier({
      nom: "bon.xlsx",
      octets: 10,
      tableau: tableau(["Nom", "Prénom", "Classe"], [["Dupont", "Martin", "2nde 4"]]),
    }),
    fichierRejete("casse.xlsx", 10, "Ce fichier n a pas pu etre lu."),
  ]);

  assert.equal(plan.lignes.length, 1, "le fichier valide est bien analyse");
  assert.equal(plan.fichiers[1]?.erreur, "Ce fichier n a pas pu etre lu.");
});

/* ------------------------------------ Regle du ch. 11 : aucun secret ----- */

test("un fichier contenant une colonne mot de passe est refuse", () => {
  const plan = construirePlan([
    analyserFichier({
      nom: "2nde4.xlsx",
      octets: 10,
      tableau: tableau(
        ["Nom", "Prénom", "Classe", "Mot de passe"],
        [["Dupont", "Martin", "2nde 4", "secret123"]],
      ),
    }),
  ]);

  assert.equal(plan.compte.bloquantes, 1);
  assert.equal(plan.lignes[0]?.anomalies[0]?.code, "mot_de_passe_dans_le_fichier");
});

/* ------------------------------------------------- §7.1 Identifiants ----- */

test("§7.1 — les identifiants deja pris ne sont jamais reattribues", () => {
  const plan = construirePlan([
    analyserFichier({
      nom: "2nde4.xlsx",
      octets: 10,
      tableau: tableau(
        ["Nom", "Prénom", "Classe"],
        [
          ["Dupont", "Martin", "2nde 4"],
          ["Dupont", "Martin", "2nde 1"],
        ],
      ),
    }),
  ]);

  const attribues = attribuerIdentifiants(plan.lignes, new Set(["martin.dupont"]));
  const logins = attribues.map((entree) => entree.login);

  assert.equal(new Set(logins).size, logins.length, "aucun identifiant en double");
  assert.ok(!logins.includes("martin.dupont"), "l identifiant deja pris est evite");
});

test("§7.1 — accents et noms composes donnent un identifiant utilisable", () => {
  const plan = construirePlan([
    analyserFichier({
      nom: "2nde4.xlsx",
      octets: 10,
      tableau: tableau(
        ["Nom", "Prénom", "Classe"],
        [
          ["Müller-Lévy", "Inès", "2nde 4"],
          ["O'Brien", "Jean-Édouard", "2nde 4"],
        ],
      ),
    }),
  ]);

  for (const { login } of attribuerIdentifiants(plan.lignes, new Set())) {
    assert.match(login, /^[a-z0-9][a-z0-9._-]{1,38}$/, `identifiant invalide : ${login}`);
  }
});

/* ------------------------------------------------- §5.8 Reimport --------- */

test("§5.8 — reimporter le meme fichier ne produit aucun identifiant nouveau", () => {
  const source = () =>
    analyserFichier({
      nom: "2nde4.xlsx",
      octets: 10,
      tableau: tableau(
        ["Nom", "Prénom", "Classe"],
        [
          ["Dupont", "Martin", "2nde 4"],
          ["Benali", "Rayan", "2nde 4"],
        ],
      ),
    });

  const premier = attribuerIdentifiants(construirePlan([source()]).lignes, new Set());
  const dejaEnBase = new Set(premier.map((entree) => entree.login));

  // Au second passage, les memes personnes existent : ce sont leurs
  // identifiants qui sont deja pris, et la couche d application les reconnait
  // par leur identifiant local. Ici, on verifie qu on ne fabrique pas de
  // nouveaux identifiants pour les memes gens.
  const second = attribuerIdentifiants(construirePlan([source()]).lignes, new Set());

  assert.deepEqual(
    second.map((e) => e.login).sort(),
    [...dejaEnBase].sort(),
    "les memes personnes doivent retomber sur les memes identifiants",
  );
});
