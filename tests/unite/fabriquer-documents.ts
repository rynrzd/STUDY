import { crc32 } from "node:zlib";

/**
 * Fabrique des PDF et des DOCX minimaux pour la recette (ch. 12, R02).
 *
 * Ces fichiers sont produits ici plutôt que déposés en binaire dans le dépôt :
 * un corpus qu'on peut lire dans le code se relit et se modifie ; un .docx
 * opaque de 40 Ko ne se relit pas. Et surtout, aucun document scolaire réel
 * n'entre dans les tests.
 */

/* -------------------------------------------------------------------------- */
/* ZIP                                                                        */
/* -------------------------------------------------------------------------- */

interface Entree {
  readonly nom: string;
  readonly contenu: Buffer;
}

/**
 * Écrit une archive ZIP « stored » — sans compression.
 *
 * Suffisant pour un DOCX : le format n'exige pas la compression, seulement la
 * structure. Écrire l'en-tête à la main évite d'ajouter une dépendance de test
 * pour trente lignes.
 */
export function zip(entrees: readonly Entree[]): Buffer {
  const locaux: Buffer[] = [];
  const central: Buffer[] = [];
  let decalage = 0;

  for (const entree of entrees) {
    const nom = Buffer.from(entree.nom, "utf8");
    const somme = crc32(entree.contenu);
    const taille = entree.contenu.length;

    const entete = Buffer.alloc(30);
    entete.writeUInt32LE(0x04034b50, 0); // signature
    entete.writeUInt16LE(20, 4); // version
    entete.writeUInt16LE(0, 6); // drapeaux
    entete.writeUInt16LE(0, 8); // méthode : stockage
    entete.writeUInt32LE(0, 10); // date et heure
    entete.writeUInt32LE(somme, 14);
    entete.writeUInt32LE(taille, 18);
    entete.writeUInt32LE(taille, 22);
    entete.writeUInt16LE(nom.length, 26);
    entete.writeUInt16LE(0, 28);

    locaux.push(entete, nom, entree.contenu);

    const fiche = Buffer.alloc(46);
    fiche.writeUInt32LE(0x02014b50, 0);
    fiche.writeUInt16LE(20, 4);
    fiche.writeUInt16LE(20, 6);
    fiche.writeUInt16LE(0, 8);
    fiche.writeUInt16LE(0, 10);
    fiche.writeUInt32LE(0, 12);
    fiche.writeUInt32LE(somme, 16);
    fiche.writeUInt32LE(taille, 20);
    fiche.writeUInt32LE(taille, 24);
    fiche.writeUInt16LE(nom.length, 28);
    fiche.writeUInt32LE(0, 38);
    fiche.writeUInt32LE(decalage, 42);

    central.push(fiche, nom);
    decalage += entete.length + nom.length + taille;
  }

  const corps = Buffer.concat(locaux);
  const repertoire = Buffer.concat(central);

  const fin = Buffer.alloc(22);
  fin.writeUInt32LE(0x06054b50, 0);
  fin.writeUInt16LE(entrees.length, 8);
  fin.writeUInt16LE(entrees.length, 10);
  fin.writeUInt32LE(repertoire.length, 12);
  fin.writeUInt32LE(corps.length, 16);

  return Buffer.concat([corps, repertoire, fin]);
}

/* -------------------------------------------------------------------------- */
/* DOCX                                                                       */
/* -------------------------------------------------------------------------- */

const TYPES = `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="xml" ContentType="application/xml"/>
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>
</Types>`;

const RELS = `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>
</Relationships>`;

/** Un paragraphe Word, avec son style éventuel. */
function paragraphe(texte: string, style?: string): string {
  const proprietes = style === undefined ? "" : `<w:pPr><w:pStyle w:val="${style}"/></w:pPr>`;
  const echappe = texte
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;");
  return `<w:p>${proprietes}<w:r><w:t xml:space="preserve">${echappe}</w:t></w:r></w:p>`;
}

export interface LigneDocx {
  readonly texte: string;
  readonly style?: "Title" | "Heading1" | "Heading2" | "ListParagraph";
}

/** Un .docx lisible par Mammoth, à partir de lignes décrites en clair. */
export function docx(lignes: readonly LigneDocx[]): Buffer {
  const corps = lignes.map((ligne) => paragraphe(ligne.texte, ligne.style)).join("");

  const document = `<?xml version="1.0" encoding="UTF-8"?>
<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">
<w:body>${corps}</w:body>
</w:document>`;

  return zip([
    { nom: "[Content_Types].xml", contenu: Buffer.from(TYPES, "utf8") },
    { nom: "_rels/.rels", contenu: Buffer.from(RELS, "utf8") },
    { nom: "word/document.xml", contenu: Buffer.from(document, "utf8") },
  ]);
}

/* -------------------------------------------------------------------------- */
/* PDF                                                                        */
/* -------------------------------------------------------------------------- */

/**
 * Un PDF d'une page portant les lignes données.
 *
 * Écrit à la main, objet par objet, avec la table des références croisées :
 * c'est le seul moyen d'avoir un PDF à couche de texte sans embarquer un
 * générateur dans les dépendances de test.
 */
export function pdf(lignes: readonly string[]): Buffer {
  const contenu =
    "BT\n/F1 12 Tf\n72 720 Td\n14 TL\n" +
    lignes
      .map((ligne) => `(${ligne.replace(/([()\\])/g, "\\$1")}) Tj T*`)
      .join("\n") +
    "\nET";

  const objets = [
    "<< /Type /Catalog /Pages 2 0 R >>",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] " +
      "/Resources << /Font << /F1 5 0 R >> >> /Contents 4 0 R >>",
    `<< /Length ${contenu.length} >>\nstream\n${contenu}\nendstream`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>",
  ];

  let sortie = "%PDF-1.4\n";
  const positions: number[] = [];

  objets.forEach((objet, index) => {
    positions.push(sortie.length);
    sortie += `${index + 1} 0 obj\n${objet}\nendobj\n`;
  });

  const debutTable = sortie.length;
  sortie += `xref\n0 ${objets.length + 1}\n0000000000 65535 f \n`;
  for (const position of positions) {
    sortie += `${String(position).padStart(10, "0")} 00000 n \n`;
  }
  sortie += `trailer\n<< /Size ${objets.length + 1} /Root 1 0 R >>\nstartxref\n${debutTable}\n%%EOF`;

  return Buffer.from(sortie, "latin1");
}

/** Un PDF sans couche de texte : une page vide, comme une photocopie scannée. */
export function pdfSansTexte(): Buffer {
  return pdf([]);
}
