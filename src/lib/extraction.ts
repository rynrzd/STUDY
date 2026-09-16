import "server-only";

import mammoth from "mammoth";
import { extractText, getDocumentProxy } from "unpdf";
import {
  VERSION_DOCUMENT,
  type AlerteConversion,
  type BlocCours,
  type DocumentCours,
  type NiveauTitre,
} from "./document-cours.ts";

/**
 * Extraction d'un document de cours — cahier « Refonte fidèle », S03 et S06.
 *
 * **Zéro token de modèle génératif** (O01). Tout se fait par lecture du fichier
 * et par règles de structure. C'est un choix de conception, pas une économie de
 * bout de chandelle : un modèle qui « comprend » un cours de mathématiques
 * finit par le reformuler, et un coefficient reformulé est une erreur que
 * personne ne voit.
 *
 * Ce qui n'est PAS fait, et qu'il faut savoir :
 *
 *  - **Aucun OCR.** Un PDF sans couche de texte — une photocopie numérisée —
 *    est refusé avec un message qui le dit. Le cahier prévoit l'OCR (S06) ;
 *    tant qu'aucun moteur n'est raccordé, refuser est la seule réponse honnête.
 *    Prétendre convertir un scan produirait un cours vide.
 *  - **Les images des DOCX ne sont pas transférées.** Leur emplacement est
 *    conservé, avec une alerte, et le professeur remet l'image lui-même.
 */

/** Ce que le cahier fixe comme budget initial (S03), ajustable. */
export const TAILLE_MAXIMALE_IMPORT = 30 * 1024 * 1024;
export const PAGES_MAXIMALES = 50;

/** Le DOCX est une archive : on borne ce qu'on accepte d'en décompresser. */
const DECOMPRESSION_MAXIMALE = 120 * 1024 * 1024;

export type FormatImport = "pdf" | "docx";

export class ImportRefuse extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ImportRefuse";
  }
}

/**
 * Reconnaît le format sur les octets.
 *
 * Le nom du fichier n'entre pas dans la décision. Un `.docx` qui commence par
 * `%PDF-` est un PDF, et un `.pdf` qui n'est ni l'un ni l'autre est refusé.
 */
export function formatDuFichier(octets: Buffer): FormatImport | null {
  if (octets.length < 8) return null;
  if (octets.subarray(0, 5).toString("latin1") === "%PDF-") return "pdf";

  // Conteneur ZIP. Seul un vrai DOCX contient `word/document.xml` ; un .doc
  // ancien, un .odt ou un .zip quelconque ne passent pas.
  const estZip = octets[0] === 0x50 && octets[1] === 0x4b;
  if (estZip && octets.includes(Buffer.from("word/document.xml"))) return "docx";

  return null;
}

/* -------------------------------------------------------------------------- */
/* PDF                                                                        */
/* -------------------------------------------------------------------------- */

/**
 * Extrait un PDF à couche de texte.
 *
 * `unpdf` rend le texte page par page. La structure — titres, listes,
 * encadrés — est déduite par des règles simples et volontairement prudentes :
 * en cas de doute, on produit un paragraphe. Un faux titre se corrige en deux
 * clics ; un paragraphe promu à tort en titre déforme le sommaire.
 */
async function extrairePdf(octets: Buffer): Promise<DocumentCours> {
  const donnees = new Uint8Array(octets);
  let pages: string[];

  try {
    const pdf = await getDocumentProxy(donnees);
    if (pdf.numPages > PAGES_MAXIMALES) {
      throw new ImportRefuse(
        `Ce document fait ${pdf.numPages} pages ; la limite est de ${PAGES_MAXIMALES}.`,
      );
    }
    const resultat = await extractText(pdf, { mergePages: false });
    pages = Array.isArray(resultat.text) ? resultat.text : [String(resultat.text)];
  } catch (erreur) {
    if (erreur instanceof ImportRefuse) throw erreur;
    throw new ImportRefuse(
      "Ce PDF n'a pas pu être lu. Il est peut-être protégé par un mot de passe ou endommagé.",
    );
  }

  const alertes: AlerteConversion[] = [];
  const blocs: BlocCours[] = [];

  pages.forEach((texte, index) => {
    const page = index + 1;
    const lignes = texte
      .split("\n")
      .map((ligne) => ligne.replace(/\s+/g, " ").trim())
      .filter((ligne) => ligne !== "");

    if (lignes.length === 0) {
      alertes.push({
        gravite: "verifier",
        page,
        message: `La page ${page} ne contient aucun texte : c'est probablement une image.`,
      });
      return;
    }

    blocs.push(...structurer(lignes, page));
  });

  if (blocs.length === 0) {
    throw new ImportRefuse(
      "Ce PDF ne contient aucun texte sélectionnable : c'est un document numérisé. " +
        "La reconnaissance de caractères n'est pas encore disponible.",
    );
  }

  // Un document dont la moitié des pages est muette est un scan partiel : on le
  // dit, plutôt que de livrer un cours à trous sans prévenir.
  const pagesMuettes = alertes.filter((alerte) => alerte.gravite === "verifier").length;
  if (pagesMuettes > 0 && pagesMuettes >= pages.length / 2) {
    throw new ImportRefuse(
      "La plupart des pages de ce PDF sont des images. La reconnaissance de " +
        "caractères n'est pas encore disponible.",
    );
  }

  return {
    version: VERSION_DOCUMENT,
    titre: titreProbable(blocs),
    blocs,
    format: "pdf",
    rapport: {
      pagesLues: pages.length,
      blocsExtraits: blocs.length,
      imagesConservees: 0,
      alertes,
    },
  };
}

/** Les intitulés qui ouvrent un encadré dans un cours français. */
const INTITULES = [
  "définition",
  "definition",
  "propriété",
  "propriete",
  "théorème",
  "theoreme",
  "remarque",
  "méthode",
  "methode",
  "exemple",
  "rappel",
];

/**
 * Déduit la structure d'une suite de lignes.
 *
 * Trois signaux seulement, et aucun n'est subtil : une ligne courte sans
 * ponctuation finale est un titre ; une ligne qui commence par une puce ou un
 * numéro ouvre une liste ; une ligne qui vaut exactement « Définition » ouvre
 * un encadré. Le reste est du paragraphe.
 */
function structurer(lignes: readonly string[], page: number): BlocCours[] {
  const blocs: BlocCours[] = [];
  let liste: string[] | null = null;
  let ordonnee = false;

  const viderListe = () => {
    if (liste !== null && liste.length > 0) {
      blocs.push({ type: "liste", ordonnee, elements: liste, origine: { page } });
    }
    liste = null;
  };

  for (let i = 0; i < lignes.length; i++) {
    const ligne = lignes[i]!;
    const puce = /^([-–•*]|\d{1,2}[.)])\s+(.*)$/.exec(ligne);

    if (puce !== null) {
      const numerotee = /^\d/.test(puce[1]!);
      if (liste === null || numerotee !== ordonnee) {
        viderListe();
        liste = [];
        ordonnee = numerotee;
      }
      liste.push(puce[2]!);
      continue;
    }

    viderListe();

    const sansAccent = ligne.toLowerCase().replace(/[:.]$/, "").trim();
    if (INTITULES.includes(sansAccent) && i + 1 < lignes.length) {
      blocs.push({
        type: "encadre",
        intitule: ligne.replace(/[:.]$/, "").trim(),
        texte: lignes[i + 1]!,
        origine: { page },
      });
      i += 1;
      continue;
    }

    if (estTitre(ligne)) {
      blocs.push({ type: "titre", niveau: niveauDeTitre(ligne), texte: ligne, origine: { page } });
      continue;
    }

    blocs.push({ type: "paragraphe", texte: ligne, origine: { page } });
  }

  viderListe();
  return blocs;
}

function estTitre(ligne: string): boolean {
  if (ligne.length > 70) return false;
  if (/[.;:,]$/.test(ligne)) return false;
  if (/^\d+[.)]/.test(ligne)) return false;
  // Un titre compte peu de mots et commence par une majuscule.
  const mots = ligne.split(" ").length;
  return mots <= 9 && /^[A-ZÀ-Ý0-9]/.test(ligne);
}

function niveauDeTitre(ligne: string): NiveauTitre {
  if (/^(chapitre|partie)\b/i.test(ligne)) return 1;
  if (/^[IVX]+\s|^\d+\s*[-–.]/.test(ligne)) return 2;
  return ligne.length <= 32 ? 2 : 3;
}

function titreProbable(blocs: readonly BlocCours[]): string {
  const premier = blocs.find((bloc) => bloc.type === "titre");
  if (premier !== undefined && premier.type === "titre") return premier.texte;

  const paragraphe = blocs.find((bloc) => bloc.type === "paragraphe");
  if (paragraphe !== undefined && paragraphe.type === "paragraphe") {
    return paragraphe.texte.slice(0, 60);
  }
  return "Document sans titre";
}

/* -------------------------------------------------------------------------- */
/* DOCX                                                                       */
/* -------------------------------------------------------------------------- */

/**
 * Extrait un DOCX.
 *
 * Mammoth produit du HTML, et sa documentation avertit explicitement que cette
 * sortie **n'est pas assainie** (T02). Elle n'est donc jamais rendue : elle est
 * relue ici par un petit analyseur qui ne reconnaît qu'une liste fermée de
 * balises et ne conserve que du texte. Un `<script>`, un `<iframe>`, un
 * attribut `onclick` ou une URL distante ne peuvent pas traverser, parce que
 * rien ne les transporte.
 */
async function extraireDocx(octets: Buffer): Promise<DocumentCours> {
  if (octets.length > DECOMPRESSION_MAXIMALE) {
    throw new ImportRefuse("Ce document est trop volumineux pour être traité.");
  }

  let html: string;
  try {
    const resultat = await mammoth.convertToHtml(
      { buffer: octets },
      {
        // Les images ne sont pas transférées : on garde la place et on le dit.
        convertImage: mammoth.images.imgElement(async () => ({ src: "" })),
      },
    );
    html = resultat.value;
  } catch {
    throw new ImportRefuse(
      "Ce fichier Word n'a pas pu être lu. S'il date d'une ancienne version (.doc), " +
        "enregistrez-le au format .docx avant de le déposer.",
    );
  }

  const { blocs, images } = lireHtmlSimple(html);

  if (blocs.length === 0) {
    throw new ImportRefuse("Ce document ne contient aucun texte.");
  }

  const alertes: AlerteConversion[] = [];
  if (images > 0) {
    alertes.push({
      gravite: "verifier",
      message:
        images === 1
          ? "Une image du document n'a pas été reprise : sa place est marquée, à vous de la remettre."
          : `${images} images du document n'ont pas été reprises : leur place est marquée, à vous de les remettre.`,
    });
  }

  return {
    version: VERSION_DOCUMENT,
    titre: titreProbable(blocs),
    blocs,
    format: "docx",
    rapport: { pagesLues: 0, blocsExtraits: blocs.length, imagesConservees: 0, alertes },
  };
}

/**
 * Analyseur HTML minimal, volontairement incapable.
 *
 * Il ne construit pas d'arbre et n'exécute rien : il parcourt les balises
 * ouvrantes qu'il connaît, prend le texte jusqu'à la fermeture correspondante,
 * et jette tout le reste. Ce qu'il ne sait pas lire n'existe pas pour lui —
 * c'est précisément la propriété recherchée face à une sortie non assainie.
 */
function lireHtmlSimple(html: string): { blocs: BlocCours[]; images: number } {
  const blocs: BlocCours[] = [];
  let images = 0;

  const motif =
    /<(h1|h2|h3|h4|h5|h6|p|li|table|img)\b[^>]*>([\s\S]*?)<\/\1>|<(img)\b[^>]*\/?>/gi;

  let listeEnCours: string[] | null = null;
  const viderListe = () => {
    if (listeEnCours !== null && listeEnCours.length > 0) {
      blocs.push({ type: "liste", ordonnee: false, elements: listeEnCours });
    }
    listeEnCours = null;
  };

  for (const trouve of html.matchAll(motif)) {
    const balise = (trouve[1] ?? trouve[3] ?? "").toLowerCase();

    if (balise === "img") {
      viderListe();
      images += 1;
      blocs.push({ type: "image", fileId: null, alt: "Image du document d'origine" });
      continue;
    }

    const texte = nettoyer(trouve[2] ?? "");
    if (texte === "") continue;

    if (balise === "li") {
      listeEnCours ??= [];
      listeEnCours.push(texte);
      continue;
    }

    viderListe();

    if (balise === "table") {
      const lignes = [...(trouve[2] ?? "").matchAll(/<tr\b[^>]*>([\s\S]*?)<\/tr>/gi)].map((tr) =>
        [...tr[1]!.matchAll(/<t[dh]\b[^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((cellule) =>
          nettoyer(cellule[1]!),
        ),
      );
      if (lignes.length > 0) {
        blocs.push({ type: "tableau", entetes: lignes[0]!, lignes: lignes.slice(1) });
      }
      continue;
    }

    if (balise.startsWith("h")) {
      const niveau = Number(balise.slice(1));
      blocs.push({
        type: "titre",
        niveau: (niveau <= 1 ? 1 : niveau === 2 ? 2 : 3) as NiveauTitre,
        texte,
      });
      continue;
    }

    const sansAccent = texte.toLowerCase().replace(/[:.]$/, "").trim();
    if (INTITULES.includes(sansAccent)) {
      blocs.push({ type: "encadre", intitule: texte.replace(/[:.]$/, ""), texte: "" });
      continue;
    }

    // Un paragraphe qui suit un encadré vide le remplit : c'est la forme
    // habituelle « Définition » sur une ligne, l'énoncé sur la suivante.
    const precedent = blocs[blocs.length - 1];
    if (precedent?.type === "encadre" && precedent.texte === "") {
      blocs[blocs.length - 1] = { ...precedent, texte };
      continue;
    }

    blocs.push({ type: "paragraphe", texte });
  }

  viderListe();
  return { blocs, images };
}

/** Enlève les balises restantes et rend les entités. Ne produit que du texte. */
function nettoyer(fragment: string): string {
  return fragment
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number(code)))
    .replace(/\s+/g, " ")
    .trim();
}

/* -------------------------------------------------------------------------- */

/**
 * Point d'entrée : des octets, un document structuré.
 *
 * Lève `ImportRefuse` avec un message destiné au professeur — précis sur ce qui
 * ne va pas, et sur ce qu'il peut faire. « Échec de la conversion » n'aide
 * personne.
 */
export async function extraire(octets: Buffer): Promise<DocumentCours> {
  if (octets.length === 0) throw new ImportRefuse("Ce fichier est vide.");
  if (octets.length > TAILLE_MAXIMALE_IMPORT) {
    throw new ImportRefuse(
      `Ce fichier dépasse ${Math.round(TAILLE_MAXIMALE_IMPORT / (1024 * 1024))} Mo.`,
    );
  }

  const format = formatDuFichier(octets);
  if (format === null) {
    throw new ImportRefuse(
      "Ce format n'est pas reconnu. Déposez un PDF ou un document Word (.docx).",
    );
  }

  return format === "pdf" ? extrairePdf(octets) : extraireDocx(octets);
}
