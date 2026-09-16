import { inflateRawSync } from "node:zlib";

/**
 * Lecture d'un fichier de rentrée : CSV ou XLSX.
 *
 * Pourquoi un lecteur écrit ici plutôt qu'une bibliothèque : les lecteurs XLSX
 * disponibles sur npm traînent soit des vulnérabilités non corrigées, soit un
 * arbre de dépendances qu'il faudrait auditer à chaque mise à jour. Le fichier
 * lu ici vient d'un navigateur, il n'est pas de confiance, et il est traité
 * côté serveur : c'est exactement le genre d'endroit où l'on ne veut pas de
 * code qu'on n'a pas lu.
 *
 * Le lecteur XLSX couvre le cas réel — un classeur exporté par un logiciel de
 * vie scolaire ou un tableur — et **refuse franchement** ce qu'il ne sait pas
 * lire, en demandant un export CSV. Il ne devine jamais : mal lire une liste
 * d'élèves est pire que de ne pas la lire.
 *
 * Limites de sécurité appliquées à tout fichier :
 *  - 5 Mo compressés au maximum ;
 *  - 40 Mo décompressés au maximum, cumulés (protection contre une archive
 *    piégée qui décompresserait en gigaoctets) ;
 *  - 5 000 lignes et 40 colonnes au maximum.
 */

export const TAILLE_MAXIMALE = 5 * 1024 * 1024;
const DECOMPRESSE_MAXIMUM = 40 * 1024 * 1024;
export const LIGNES_MAXIMUM = 5000;
const COLONNES_MAXIMUM = 40;

export class FichierIllisible extends Error {
  constructor(message: string) {
    super(message);
    this.name = "FichierIllisible";
  }
}

export interface Tableau {
  readonly entetes: string[];
  readonly lignes: string[][];
}

/** Point d'entrée : choisit le lecteur d'après le nom du fichier. */
export function lireTableur(nom: string, contenu: Buffer): Tableau {
  if (contenu.length > TAILLE_MAXIMALE) {
    throw new FichierIllisible("Le fichier dépasse 5 Mo. Réduisez-le ou découpez-le.");
  }
  if (contenu.length === 0) {
    throw new FichierIllisible("Le fichier est vide.");
  }

  const minuscule = nom.toLowerCase();

  if (minuscule.endsWith(".csv") || minuscule.endsWith(".txt")) {
    return lireCsv(contenu);
  }
  if (minuscule.endsWith(".xlsx")) {
    return lireXlsx(contenu);
  }
  if (minuscule.endsWith(".xls")) {
    throw new FichierIllisible(
      "L'ancien format .xls n'est pas lu. Enregistrez le fichier au format .xlsx ou .csv.",
    );
  }

  throw new FichierIllisible("Format non reconnu. Déposez un fichier .xlsx ou .csv.");
}

/* -------------------------------------------------------------------------- */
/* CSV                                                                         */
/* -------------------------------------------------------------------------- */

/**
 * Lecture CSV tolérante aux réalités françaises : séparateur point-virgule,
 * encodage Windows-1252, BOM UTF-8, guillemets doublés, retours à la ligne
 * dans une cellule entre guillemets.
 */
export function lireCsv(contenu: Buffer): Tableau {
  const texte = decoder(contenu);
  const separateur = deviner(texte);

  const lignes: string[][] = [];
  let cellule = "";
  let ligne: string[] = [];
  let entreGuillemets = false;

  for (let i = 0; i < texte.length; i++) {
    const caractere = texte[i]!;

    if (entreGuillemets) {
      if (caractere === '"') {
        if (texte[i + 1] === '"') {
          cellule += '"';
          i++;
        } else {
          entreGuillemets = false;
        }
      } else {
        cellule += caractere;
      }
      continue;
    }

    if (caractere === '"' && cellule === "") {
      entreGuillemets = true;
    } else if (caractere === separateur) {
      ligne.push(cellule.trim());
      cellule = "";
    } else if (caractere === "\n") {
      ligne.push(cellule.trim());
      cellule = "";
      if (ligne.some((valeur) => valeur !== "")) lignes.push(ligne);
      ligne = [];
      if (lignes.length > LIGNES_MAXIMUM) {
        throw new FichierIllisible(`Le fichier dépasse ${LIGNES_MAXIMUM} lignes.`);
      }
    } else if (caractere !== "\r") {
      cellule += caractere;
    }
  }

  ligne.push(cellule.trim());
  if (ligne.some((valeur) => valeur !== "")) lignes.push(ligne);

  return enTableau(lignes);
}

/** UTF-8 si le contenu est valide, Windows-1252 sinon. */
function decoder(contenu: Buffer): string {
  let debut = 0;
  if (contenu[0] === 0xef && contenu[1] === 0xbb && contenu[2] === 0xbf) debut = 3;

  const utf8 = new TextDecoder("utf-8", { fatal: false }).decode(contenu.subarray(debut));
  // U+FFFD signale un octet non décodable : le fichier vient alors d'un
  // tableur configuré en Windows-1252, cas le plus fréquent en France.
  if (!utf8.includes("�")) return utf8;

  return new TextDecoder("windows-1252").decode(contenu.subarray(debut));
}

/** Séparateur le plus fréquent sur la première ligne. */
function deviner(texte: string): string {
  const premiere = texte.slice(0, texte.indexOf("\n") === -1 ? texte.length : texte.indexOf("\n"));
  const candidats = [";", ",", "\t"];
  let meilleur = ";";
  let compte = -1;

  for (const candidat of candidats) {
    const occurrences = premiere.split(candidat).length - 1;
    if (occurrences > compte) {
      compte = occurrences;
      meilleur = candidat;
    }
  }
  return meilleur;
}

/* -------------------------------------------------------------------------- */
/* XLSX                                                                        */
/* -------------------------------------------------------------------------- */

/**
 * Lecture XLSX : un fichier XLSX est une archive ZIP contenant du XML.
 *
 * On lit la première feuille et la table des chaînes partagées. Les formules ne
 * sont pas évaluées : c'est leur dernière valeur calculée qui est reprise,
 * exactement ce qu'affichait le tableur.
 */
export function lireXlsx(contenu: Buffer): Tableau {
  const fichiers = lireZip(contenu);

  const feuille =
    fichiers.get("xl/worksheets/sheet1.xml") ??
    [...fichiers.entries()].find(([nom]) => nom.startsWith("xl/worksheets/sheet"))?.[1];

  if (feuille === undefined) {
    throw new FichierIllisible(
      "Ce classeur ne contient aucune feuille lisible. Enregistrez-le au format .csv.",
    );
  }

  const partagees = lireChainesPartagees(fichiers.get("xl/sharedStrings.xml"));
  const xml = feuille.toString("utf8");

  const lignes: string[][] = [];

  for (const brute of xml.split("<row ").slice(1)) {
    const ligne: string[] = [];

    for (const celluleBrute of brute.split("<c ").slice(1)) {
      const reference = /r="([A-Z]+)\d+"/.exec(celluleBrute)?.[1];
      const colonne = reference === undefined ? ligne.length : indiceColonne(reference);
      if (colonne >= COLONNES_MAXIMUM) continue;

      while (ligne.length < colonne) ligne.push("");
      ligne[colonne] = valeurCellule(celluleBrute, partagees);
    }

    if (ligne.some((valeur) => valeur !== "")) lignes.push(ligne);
    if (lignes.length > LIGNES_MAXIMUM) {
      throw new FichierIllisible(`Le fichier dépasse ${LIGNES_MAXIMUM} lignes.`);
    }
  }

  return enTableau(lignes);
}

function valeurCellule(brute: string, partagees: string[]): string {
  const type = /t="([^"]+)"/.exec(brute)?.[1];

  if (type === "inlineStr") {
    return texteXml(brute.match(/<t[^>]*>([\s\S]*?)<\/t>/g)?.join("") ?? "");
  }

  const valeur = /<v>([\s\S]*?)<\/v>/.exec(brute)?.[1];
  if (valeur === undefined) return "";

  if (type === "s") {
    const index = Number.parseInt(valeur, 10);
    return partagees[index] ?? "";
  }

  return decoderEntites(valeur).trim();
}

function lireChainesPartagees(source: Buffer | undefined): string[] {
  if (source === undefined) return [];
  const xml = source.toString("utf8");

  return xml
    .split("<si>")
    .slice(1)
    .map((bloc) => texteXml(bloc.slice(0, bloc.indexOf("</si>"))));
}

/** Concatène les fragments <t> d'un bloc, en ignorant les balises de style. */
function texteXml(bloc: string): string {
  const fragments = bloc.match(/<t[^>]*>([\s\S]*?)<\/t>/g) ?? [];
  return decoderEntites(
    fragments.map((fragment) => fragment.replace(/<[^>]+>/g, "")).join(""),
  ).trim();
}

function decoderEntites(texte: string): string {
  return texte
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number.parseInt(code, 10)))
    .replace(/&amp;/g, "&");
}

function indiceColonne(reference: string): number {
  let valeur = 0;
  for (const lettre of reference) {
    valeur = valeur * 26 + (lettre.charCodeAt(0) - 64);
  }
  return valeur - 1;
}

/* -------------------------------------------------------------------------- */
/* ZIP                                                                         */
/* -------------------------------------------------------------------------- */

/**
 * Extraction ZIP minimale, lue depuis le répertoire central.
 *
 * Le total décompressé est plafonné : une archive de quelques kilo-octets peut
 * sinon se déplier en plusieurs gigaoctets et faire tomber le serveur.
 */
function lireZip(contenu: Buffer): Map<string, Buffer> {
  const fichiers = new Map<string, Buffer>();

  // Fin du répertoire central : signature 0x06054b50, cherchée depuis la fin.
  let finCentral = -1;
  for (let i = contenu.length - 22; i >= 0 && i > contenu.length - 65_557; i--) {
    if (contenu.readUInt32LE(i) === 0x06054b50) {
      finCentral = i;
      break;
    }
  }
  if (finCentral === -1) {
    throw new FichierIllisible("Ce fichier .xlsx est illisible. Enregistrez-le au format .csv.");
  }

  const nombre = contenu.readUInt16LE(finCentral + 10);
  let position = contenu.readUInt32LE(finCentral + 16);
  let cumule = 0;

  for (let index = 0; index < nombre; index++) {
    if (position + 46 > contenu.length) break;
    if (contenu.readUInt32LE(position) !== 0x02014b50) break;

    const methode = contenu.readUInt16LE(position + 10);
    const tailleCompressee = contenu.readUInt32LE(position + 20);
    const tailleReelle = contenu.readUInt32LE(position + 24);
    const longueurNom = contenu.readUInt16LE(position + 28);
    const longueurExtra = contenu.readUInt16LE(position + 30);
    const longueurCommentaire = contenu.readUInt16LE(position + 32);
    const debutLocal = contenu.readUInt32LE(position + 42);

    const nom = contenu.subarray(position + 46, position + 46 + longueurNom).toString("utf8");
    position += 46 + longueurNom + longueurExtra + longueurCommentaire;

    // Seuls les deux fichiers utiles sont décompressés.
    const utile = nom === "xl/sharedStrings.xml" || nom.startsWith("xl/worksheets/sheet");
    if (!utile) continue;

    cumule += tailleReelle;
    if (cumule > DECOMPRESSE_MAXIMUM) {
      throw new FichierIllisible("Ce classeur est trop volumineux une fois décompressé.");
    }

    const longueurNomLocal = contenu.readUInt16LE(debutLocal + 26);
    const longueurExtraLocal = contenu.readUInt16LE(debutLocal + 28);
    const debutDonnees = debutLocal + 30 + longueurNomLocal + longueurExtraLocal;
    const donnees = contenu.subarray(debutDonnees, debutDonnees + tailleCompressee);

    try {
      fichiers.set(nom, methode === 0 ? Buffer.from(donnees) : inflateRawSync(donnees));
    } catch {
      throw new FichierIllisible(
        "Ce fichier .xlsx n'a pas pu être décompressé. Enregistrez-le au format .csv.",
      );
    }
  }

  return fichiers;
}

/* -------------------------------------------------------------------------- */

function enTableau(lignes: string[][]): Tableau {
  if (lignes.length === 0) {
    throw new FichierIllisible("Le fichier ne contient aucune ligne.");
  }

  const entetes = (lignes[0] ?? []).map((entete) => entete.trim());
  if (entetes.every((entete) => entete === "")) {
    throw new FichierIllisible("La première ligne doit contenir les noms des colonnes.");
  }

  return { entetes, lignes: lignes.slice(1) };
}
