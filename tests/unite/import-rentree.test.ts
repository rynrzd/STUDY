import assert from "node:assert/strict";
import test from "node:test";
import {
  analyser,
  colonnesManquantes,
  proposerLogin,
  reconnaitreColonnes,
} from "../../src/lib/import-rentree.ts";
import { lireCsv, lireXlsx } from "../../src/lib/tableur.ts";

/**
 * Import de rentrée (finition V1, §5.4).
 *
 * Le point le plus important est négatif : **deux classes de même niveau
 * restent indépendantes**, et deux orthographes différentes ne sont pas
 * fusionnées. Un import qui devine produit des dégâts silencieux — un élève
 * inscrit dans la mauvaise classe voit les devoirs d'une autre.
 */

test("les colonnes sont reconnues malgre accents, casse et separateurs", () => {
  const correspondance = reconnaitreColonnes(["NOM", "Prénom", "classe", "INE"]);

  assert.equal(correspondance.nom, 0);
  assert.equal(correspondance.prenom, 1);
  assert.equal(correspondance.classe, 2);
  assert.equal(correspondance.identifiantExterne, 3);
  assert.deepEqual(colonnesManquantes(correspondance), []);
});

test("une colonne obligatoire absente est nommee, pas devinee", () => {
  const correspondance = reconnaitreColonnes(["Nom", "Prénom"]);
  assert.deepEqual(colonnesManquantes(correspondance), ["classe"]);
});

test("le CSV francais se lit : point-virgule, guillemets, accents", () => {
  const csv = Buffer.from(
    'Nom;Prénom;Classe\r\n"Durand, épouse Martin";Amélie;2nde 1\r\nBernard;Jean;2nde 1\r\n',
    "utf8",
  );

  const tableau = lireCsv(csv);

  assert.deepEqual(tableau.entetes, ["Nom", "Prénom", "Classe"]);
  assert.equal(tableau.lignes.length, 2);
  assert.equal(tableau.lignes[0]?.[0], "Durand, épouse Martin");
  assert.equal(tableau.lignes[0]?.[1], "Amélie");
});

test("un CSV encode en Windows-1252 reste lisible", () => {
  // « Amélie » en Windows-1252 : le é vaut 0xE9.
  const octets = Buffer.concat([
    Buffer.from("Nom;Prenom;Classe\n", "latin1"),
    Buffer.from([0x44, 0x75, 0x72, 0x61, 0x6e, 0x64]), // Durand
    Buffer.from(";Am", "latin1"),
    Buffer.from([0xe9]),
    Buffer.from("lie;2nde 1\n", "latin1"),
  ]);

  const tableau = lireCsv(octets);
  assert.equal(tableau.lignes[0]?.[1], "Amélie");
});

test("deux orthographes de la meme classe ne sont PAS fusionnees", () => {
  const csv = Buffer.from(
    "Nom;Prénom;Classe\nDurand;Amélie;2nde 1\nBernard;Jean;Seconde 1\n",
    "utf8",
  );
  const tableau = lireCsv(csv);
  const analyse = analyser(tableau, reconnaitreColonnes(tableau.entetes));

  // Le cahier des charges est explicite : une equivalence se propose, elle ne
  // s applique pas toute seule. L administrateur corrigera son fichier s il
  // voulait une seule classe.
  assert.deepEqual(analyse.classes, ["2nde 1", "Seconde 1"]);
  assert.equal(analyse.resume.classes, 2);
});

test("deux classes de meme niveau restent distinctes", () => {
  const csv = Buffer.from(
    "Nom;Prénom;Classe\nA;A;Seconde 1\nB;B;Seconde 2\nC;C;Seconde 1\n",
    "utf8",
  );
  const tableau = lireCsv(csv);
  const analyse = analyser(tableau, reconnaitreColonnes(tableau.entetes));

  assert.deepEqual(analyse.classes, ["Seconde 1", "Seconde 2"]);
  assert.equal(analyse.resume.valides, 3);
});

test("une ligne incomplete est rejetee avec son numero, jamais completee", () => {
  const csv = Buffer.from("Nom;Prénom;Classe\nDurand;;2nde 1\n;Jean;2nde 1\nOk;Léa;2nde 1\n", "utf8");
  const tableau = lireCsv(csv);
  const analyse = analyser(tableau, reconnaitreColonnes(tableau.entetes));

  assert.equal(analyse.resume.rejetees, 2);
  assert.equal(analyse.rejetees[0]?.numero, 2, "la numerotation suit celle du tableur");
  assert.equal(analyse.rejetees[0]?.probleme, "Prénom manquant");
  assert.equal(analyse.rejetees[1]?.probleme, "Nom manquant");
  assert.equal(analyse.resume.valides, 1);
});

test("les identifiants proposes sont uniques, sans accent, et respectent le format de la base", () => {
  const csv = Buffer.from(
    "Nom;Prénom;Classe\nDurand;Amélie;2nde 1\nDurand;Amélie;2nde 2\nDURAND;AMELIE;2nde 3\n",
    "utf8",
  );
  const tableau = lireCsv(csv);
  const analyse = analyser(tableau, reconnaitreColonnes(tableau.entetes));

  const logins = analyse.valides.map((ligne) => ligne.login);
  assert.deepEqual(logins, ["amelie.durand", "amelie.durand2", "amelie.durand3"]);

  // Contrainte memberships_login_format de la migration 0002.
  for (const login of logins) {
    assert.match(login, /^[a-z0-9][a-z0-9._-]{1,38}$/);
  }
});

test("un identifiant deja pris dans l etablissement n est pas reattribue", () => {
  const csv = Buffer.from("Nom;Prénom;Classe\nDurand;Amélie;2nde 1\n", "utf8");
  const tableau = lireCsv(csv);
  const analyse = analyser(tableau, reconnaitreColonnes(tableau.entetes), ["amelie.durand"]);

  assert.equal(analyse.valides[0]?.login, "amelie.durand2");
});

test("un nom sans lettre latine recoit quand meme un identifiant valide", () => {
  const login = proposerLogin("李", "王", new Set());
  assert.match(login, /^[a-z0-9][a-z0-9._-]{1,38}$/);
});

test("un classeur XLSX minimal se lit comme un CSV", () => {
  const classeur = classeurMinimal();
  const tableau = lireXlsx(classeur);

  assert.deepEqual(tableau.entetes, ["Nom", "Prénom", "Classe"]);
  assert.equal(tableau.lignes.length, 2);
  assert.deepEqual(tableau.lignes[0], ["Durand", "Amélie", "2nde 1"]);
  assert.deepEqual(tableau.lignes[1], ["Bernard", "Jean", "2nde 2"]);
});

/* -------------------------------------------------------------------------- */

/**
 * Construit un .xlsx minimal : une archive ZIP non compressée contenant la
 * feuille et la table des chaînes partagées. C'est exactement la structure
 * qu'un tableur produit, en plus petit.
 */
function classeurMinimal(): Buffer {
  const chaines = [
    "Nom",
    "Prénom",
    "Classe",
    "Durand",
    "Amélie",
    "2nde 1",
    "Bernard",
    "Jean",
    "2nde 2",
  ];

  const sharedStrings =
    `<?xml version="1.0"?><sst count="${chaines.length}" uniqueCount="${chaines.length}">` +
    chaines.map((valeur) => `<si><t>${valeur}</t></si>`).join("") +
    "</sst>";

  const ligne = (numero: number, indices: number[]) =>
    `<row r="${numero}">` +
    indices
      .map(
        (indice, colonne) =>
          `<c r="${String.fromCharCode(65 + colonne)}${numero}" t="s"><v>${indice}</v></c>`,
      )
      .join("") +
    "</row>";

  const feuille =
    `<?xml version="1.0"?><worksheet><sheetData>` +
    ligne(1, [0, 1, 2]) +
    ligne(2, [3, 4, 5]) +
    ligne(3, [6, 7, 8]) +
    `</sheetData></worksheet>`;

  return zipSansCompression([
    ["xl/sharedStrings.xml", Buffer.from(sharedStrings, "utf8")],
    ["xl/worksheets/sheet1.xml", Buffer.from(feuille, "utf8")],
  ]);
}

/** Archive ZIP « stored » (méthode 0), suffisante pour ce test. */
function zipSansCompression(fichiers: [string, Buffer][]): Buffer {
  const morceaux: Buffer[] = [];
  const central: Buffer[] = [];
  let position = 0;

  for (const [nom, contenu] of fichiers) {
    const nomOctets = Buffer.from(nom, "utf8");
    const crc = crc32(contenu);

    const entete = Buffer.alloc(30);
    entete.writeUInt32LE(0x04034b50, 0);
    entete.writeUInt16LE(20, 4);
    entete.writeUInt16LE(0, 6);
    entete.writeUInt16LE(0, 8); // stored
    entete.writeUInt32LE(crc, 14);
    entete.writeUInt32LE(contenu.length, 18);
    entete.writeUInt32LE(contenu.length, 22);
    entete.writeUInt16LE(nomOctets.length, 26);
    entete.writeUInt16LE(0, 28);

    morceaux.push(entete, nomOctets, contenu);

    const entree = Buffer.alloc(46);
    entree.writeUInt32LE(0x02014b50, 0);
    entree.writeUInt16LE(20, 4);
    entree.writeUInt16LE(20, 6);
    entree.writeUInt16LE(0, 10); // stored
    entree.writeUInt32LE(crc, 16);
    entree.writeUInt32LE(contenu.length, 20);
    entree.writeUInt32LE(contenu.length, 24);
    entree.writeUInt16LE(nomOctets.length, 28);
    entree.writeUInt32LE(position, 42);

    central.push(entree, nomOctets);
    position += entete.length + nomOctets.length + contenu.length;
  }

  const donneesCentral = Buffer.concat(central);
  const fin = Buffer.alloc(22);
  fin.writeUInt32LE(0x06054b50, 0);
  fin.writeUInt16LE(fichiers.length, 8);
  fin.writeUInt16LE(fichiers.length, 10);
  fin.writeUInt32LE(donneesCentral.length, 12);
  fin.writeUInt32LE(position, 16);

  return Buffer.concat([...morceaux, donneesCentral, fin]);
}

function crc32(donnees: Buffer): number {
  let crc = 0xffffffff;
  for (const octet of donnees) {
    crc ^= octet;
    for (let bit = 0; bit < 8; bit++) {
      crc = crc & 1 ? (crc >>> 1) ^ 0xedb88320 : crc >>> 1;
    }
  }
  return (crc ^ 0xffffffff) >>> 0;
}
