// =============================================================================
// Écrire de vrais fichiers .xlsx, sans dépendance.
//
// Le cahier demande des fichiers .xlsx **réels**, pas des CSV renommés : c'est
// ce que déposent les lycées, et c'est précisément là que les surprises
// arrivent — accents, apostrophes, cellules vides, colonnes déplacées.
//
// Un .xlsx est une archive ZIP de XML. Le lecteur du produit accepte les
// entrées stockées sans compression, ce qui permet d'écrire l'archive à la
// main : une vingtaine de lignes, et aucune dépendance de plus dans un dépôt
// qui en compte neuf.
//
// Les chaînes sont écrites en ligne (`inlineStr`) plutôt que dans une table
// partagée : un fichier par test, quelques dizaines de lignes, la table
// partagée n'économiserait rien et ferait un format de plus à produire juste.
// =============================================================================

import { crc32 } from "node:zlib";

/** Échappe ce qui ne peut pas entrer tel quel dans du XML. */
function xml(valeur) {
  return String(valeur)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

/** La référence d'une colonne : 0 → A, 25 → Z, 26 → AA. */
function colonne(indice) {
  let reste = indice;
  let nom = "";
  do {
    nom = String.fromCharCode(65 + (reste % 26)) + nom;
    reste = Math.floor(reste / 26) - 1;
  } while (reste >= 0);
  return nom;
}

function feuille(lignes) {
  const corps = lignes
    .map((cellules, index) => {
      const numero = index + 1;
      const contenu = cellules
        .map((valeur, colonneIndex) => {
          if (valeur === null || valeur === undefined || valeur === "") return "";
          return (
            `<c r="${colonne(colonneIndex)}${numero}" t="inlineStr">` +
            `<is><t xml:space="preserve">${xml(valeur)}</t></is></c>`
          );
        })
        .join("");
      return `<row r="${numero}">${contenu}</row>`;
    })
    .join("");

  return (
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">` +
    `<sheetData>${corps}</sheetData></worksheet>`
  );
}

const CONTENT_TYPES =
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
  `<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">` +
  `<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>` +
  `<Default Extension="xml" ContentType="application/xml"/>` +
  `<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>` +
  `<Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>` +
  `</Types>`;

const RELS =
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
  `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
  `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>` +
  `</Relationships>`;

const WORKBOOK =
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
  `<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ` +
  `xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">` +
  `<sheets><sheet name="Feuille1" sheetId="1" r:id="rId1"/></sheets></workbook>`;

const WORKBOOK_RELS =
  `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
  `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
  `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>` +
  `</Relationships>`;

/** Assemble une archive ZIP à entrées stockées. */
function zip(entrees) {
  const locaux = [];
  const central = [];
  let decalage = 0;

  for (const [nom, texte] of entrees) {
    const donnees = Buffer.from(texte, "utf8");
    const nomBuffer = Buffer.from(nom, "utf8");
    const somme = crc32(donnees);

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4); // version minimale
    local.writeUInt16LE(0, 6); // aucun drapeau
    local.writeUInt16LE(0, 8); // stocké, non compressé
    local.writeUInt16LE(0, 10); // heure
    local.writeUInt16LE(0x21, 12); // date : 1980-01-01, stable d'un run à l'autre
    local.writeUInt32LE(somme, 14);
    local.writeUInt32LE(donnees.length, 18);
    local.writeUInt32LE(donnees.length, 22);
    local.writeUInt16LE(nomBuffer.length, 26);
    local.writeUInt16LE(0, 28);

    locaux.push(local, nomBuffer, donnees);

    const entree = Buffer.alloc(46);
    entree.writeUInt32LE(0x02014b50, 0);
    entree.writeUInt16LE(20, 4);
    entree.writeUInt16LE(20, 6);
    entree.writeUInt16LE(0, 8);
    entree.writeUInt16LE(0, 10);
    entree.writeUInt16LE(0, 12);
    entree.writeUInt16LE(0x21, 14);
    entree.writeUInt32LE(somme, 16);
    entree.writeUInt32LE(donnees.length, 20);
    entree.writeUInt32LE(donnees.length, 24);
    entree.writeUInt16LE(nomBuffer.length, 28);
    entree.writeUInt16LE(0, 30);
    entree.writeUInt16LE(0, 32);
    entree.writeUInt16LE(0, 34);
    entree.writeUInt16LE(0, 36);
    entree.writeUInt32LE(0, 38);
    entree.writeUInt32LE(decalage, 42);

    central.push(entree, nomBuffer);
    decalage += local.length + nomBuffer.length + donnees.length;
  }

  const corpsCentral = Buffer.concat(central);
  const fin = Buffer.alloc(22);
  fin.writeUInt32LE(0x06054b50, 0);
  fin.writeUInt16LE(0, 4);
  fin.writeUInt16LE(0, 6);
  fin.writeUInt16LE(entrees.length, 8);
  fin.writeUInt16LE(entrees.length, 10);
  fin.writeUInt32LE(corpsCentral.length, 12);
  fin.writeUInt32LE(decalage, 16);
  fin.writeUInt16LE(0, 20);

  return Buffer.concat([...locaux, corpsCentral, fin]);
}

/**
 * Un classeur .xlsx d'une feuille, à partir d'un tableau de lignes.
 *
 * `lignes` est un tableau de tableaux de chaînes ; la première ligne sert
 * d'en-tête, comme dans les fichiers que déposent les établissements.
 */
export function classeur(lignes) {
  return zip([
    ["[Content_Types].xml", CONTENT_TYPES],
    ["_rels/.rels", RELS],
    ["xl/workbook.xml", WORKBOOK],
    ["xl/_rels/workbook.xml.rels", WORKBOOK_RELS],
    ["xl/worksheets/sheet1.xml", feuille(lignes)],
  ]);
}
