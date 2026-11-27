import { TAILLE_MAX_DEPOT } from "./limites-depot.ts";
import "server-only";

import mammoth from "mammoth";
import sharp from "sharp";
import { extractImages, extractText, getDocumentProxy, getResolvedPDFJS } from "unpdf";
import { analyserImageStudio, imageDocxValide, MAX_IMAGES_DOCX, MAX_OCTETS_IMAGES } from "./images-studio.ts";
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
 *  - **Les images hors PNG/JPEG ou au-delà des budgets restent à reprendre.**
 *    Leur emplacement et une alerte explicite sont conservés.
 */

/** Ce que le cahier fixe comme budget initial (S03), ajustable. */
export const TAILLE_MAXIMALE_IMPORT = TAILLE_MAX_DEPOT;
export const PAGES_MAXIMALES = 50;

/** Le DOCX est une archive : on borne ce qu'on accepte d'en décompresser. */
const DECOMPRESSION_MAXIMALE = 120 * 1024 * 1024;

/**
 * ZIP preflight: the compressed upload limit alone does not stop a ZIP bomb.
 * Read ONLY the central-directory metadata (no decompression or allocation).
 * Unsupported ZIP64/invalid directories fail closed with a useful message.
 */
function verifierTailleDocx(octets: Buffer): void {
  let fin = -1;
  for (let i = octets.length - 22; i >= Math.max(0, octets.length - 65_557); i--) {
    if (octets.readUInt32LE(i) === 0x06054b50 && i + 22 + octets.readUInt16LE(i + 20) === octets.length) {
      fin = i;
      break;
    }
  }
  const refus = () => new ImportRefuse("L'archive Word est endommagée ou son format ZIP n'est pas pris en charge.");
  if (fin < 0) throw refus();
  const entrees = octets.readUInt16LE(fin + 10);
  const tailleAnnuaire = octets.readUInt32LE(fin + 12);
  const debutAnnuaire = octets.readUInt32LE(fin + 16);
  if (entrees === 0xffff || debutAnnuaire === 0xffffffff ||
      debutAnnuaire + tailleAnnuaire > fin) throw refus();

  let position = debutAnnuaire;
  let total = 0;
  for (let i = 0; i < entrees; i++) {
    if (position + 46 > fin || octets.readUInt32LE(position) !== 0x02014b50) throw refus();
    const taille = octets.readUInt32LE(position + 24);
    if (taille === 0xffffffff) throw refus();
    total += taille;
    if (total > DECOMPRESSION_MAXIMALE) {
      throw new ImportRefuse("Ce document Word se décompresse en plus de 120 Mo : il est trop volumineux.");
    }
    position += 46 + octets.readUInt16LE(position + 28) +
      octets.readUInt16LE(position + 30) + octets.readUInt16LE(position + 32);
  }
  if (position !== debutAnnuaire + tailleAnnuaire) throw refus();
}

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
async function extrairePdf(octets: Buffer, options: OptionsExtraction): Promise<DocumentCours> {
  const donnees = new Uint8Array(octets);
  let pages: string[];
  let pdf: Awaited<ReturnType<typeof getDocumentProxy>> | undefined;
  const figures = new Map<number, BlocCours[]>();
  const alertesFigures: AlerteConversion[] = [];
  let imagesConservees = 0;
  let octetsImages = 0;
  let imagesVues = 0;

  try {
    pdf = await getDocumentProxy(donnees, { maxImageSize: 4_000_000 });
    if (pdf.numPages > PAGES_MAXIMALES) {
      throw new ImportRefuse(
        `Ce document fait ${pdf.numPages} pages ; la limite est de ${PAGES_MAXIMALES}.`,
      );
    }
    const resultat = await extractText(pdf, { mergePages: false });
    pages = Array.isArray(resultat.text) ? resultat.text : [String(resultat.text)];
    const { OPS } = await getResolvedPDFJS();
    for (let numero = 1; numero <= pages.length; numero++) {
      const pagePdf = await pdf.getPage(numero);
      try {
        const ops = await pagePdf.getOperatorList();
        const peintures = ops.fnArray.filter((op: number) => op === OPS.paintImageXObject).length;
        const autres = ops.fnArray.some((op: number) => [OPS.paintInlineImageXObject, OPS.paintImageMaskXObject,
          OPS.paintImageXObjectRepeat, OPS.paintInlineImageXObjectGroup].includes(op));
        if (!pages[numero - 1]?.trim()) continue;
        if (ops.fnArray.includes(OPS.constructPath) || ops.fnArray.includes(OPS.shadingFill)) {
          alertesFigures.push({ gravite: "verifier", page: numero, message: `Les tracés vectoriels de la page ${numero} sont visibles dans le PDF original. Vérifiez les schémas dans la version transformée.` });
        }
        if (!peintures && !autres) continue;
        imagesVues += peintures;
        let reprises = 0;
        if (peintures && options.conserverImage && imagesVues <= MAX_IMAGES_DOCX && octetsImages < MAX_OCTETS_IMAGES) {
          for (const image of await extractImages(pdf, numero)) {
            if (image.width * image.height > 4_000_000 || image.width > 6000 || image.height > 6000) continue;
            const png = await sharp(image.data, { raw: image }).png().toBuffer();
            if (!imageDocxValide(png, "image/png") || octetsImages + png.length > MAX_OCTETS_IMAGES) continue;
            octetsImages += png.length;
            const ref = await options.conserverImage(png, "png");
            if (!ref || !analyserImageStudio(ref)) continue;
            const blocsPage = figures.get(numero) ?? [];
            blocsPage.push({ type: "image", fileId: ref, alt: `Illustration ${++reprises} de la page ${numero}`, origine: { page: numero } });
            figures.set(numero, blocsPage);
            imagesConservees++;
          }
        }
        if (reprises < peintures || autres) {
          alertesFigures.push({ gravite: "verifier", page: numero, message: `Certaines illustrations de la page ${numero} sont disponibles uniquement dans le PDF original.` });
        }
      } catch {
        alertesFigures.push({ gravite: "verifier", page: numero, message: `Vérifiez les illustrations de la page ${numero} dans le PDF original : la reprise est incomplète.` });
      } finally {
        pagePdf.cleanup();
      }
    }
  } catch (erreur) {
    if (erreur instanceof ImportRefuse) throw erreur;
    throw new ImportRefuse(
      "Ce PDF n'a pas pu être lu. Il est peut-être protégé par un mot de passe ou endommagé.",
    );
  } finally {
    await pdf?.loadingTask.destroy();
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

    blocs.push(...structurer(lignes, page), ...(figures.get(page) ?? []));
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
      imagesConservees,
      alertes: [...alertes, ...alertesFigures],
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
  "à retenir",
  "a retenir",
  "formule",
  "objectif",
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

    const etiquette = /^([^:]{2,24})\s*:\s*(.+)$/u.exec(ligne);
    if (etiquette && INTITULES.includes(etiquette[1]!.trim().toLowerCase())) {
      blocs.push({ type: "encadre", intitule: etiquette[1]!.trim(), texte: etiquette[2]!, origine: { page } });
      continue;
    }

    // Une ligne qui reprend au milieu d’une phrase appartient au bloc précédent.
    const precedent = blocs.at(-1);
    if ((precedent?.type === "encadre" || precedent?.type === "paragraphe") &&
        /[\p{L},]$/u.test(precedent.texte) && /^\p{Ll}/u.test(ligne)) {
      blocs[blocs.length - 1] = { ...precedent, texte: precedent.texte + " " + ligne };
      continue;
    }

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

    if (estTitre(ligne, page === 1 && i === 0)) {
      blocs.push({ type: "titre", niveau: niveauDeTitre(ligne), texte: ligne, origine: { page } });
      continue;
    }

    blocs.push({ type: "paragraphe", texte: ligne, origine: { page } });
  }

  viderListe();
  return blocs;
}

function estTitre(ligne: string, debutDocument: boolean): boolean {
  if (ligne.length > 70) return false;
  if (/[.;:,]$/.test(ligne)) return false;
  if (debutDocument) return true;

  // La longueur et une majuscule ne suffisent pas : sur les anciens PDF,
  // chaque ligne d'un paragraphe devenait un faux sous-titre. Un signal de
  // structure identifiable est nécessaire pour les lignes suivantes.
  if (/^(chapitre|partie|leçon|lecon|cours|activité|activite|fiche|séance|seance)\b/iu.test(ligne)) return true;
  if (/^(?:[IVX]+|\d+(?:\.\d+)*)\s*[-–.)]\s+\S/u.test(ligne)) return true;
  const lettres = ligne.replace(/[^\p{L}]/gu, "");
  return lettres.length >= 4 && ligne.length <= 60 && lettres === lettres.toLocaleUpperCase("fr");
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
export interface OptionsExtraction {
  /** Facultatif : le worker conserve l'image dans le stockage privé. */
  readonly conserverImage?: (octets: Buffer, extension: "png" | "jpg") => Promise<string | null>;
}

async function extraireDocx(octets: Buffer, options: OptionsExtraction): Promise<DocumentCours> {
  if (octets.length > DECOMPRESSION_MAXIMALE) {
    throw new ImportRefuse("Ce document est trop volumineux pour être traité.");
  }
  verifierTailleDocx(octets);

  let html: string;
  let imagesRencontrees = 0;
  let octetsImages = 0;
  const references = new Map<number, string>();
  try {
    const resultat = await mammoth.convertToHtml(
      { buffer: octets },
      {
        convertImage: mammoth.images.imgElement(async (image) => {
          const numero = ++imagesRencontrees;
          const src = `study-image-${numero}`;
          if (!options.conserverImage || numero > MAX_IMAGES_DOCX) return { src };
          try {
            const donnees = await image.readAsBuffer();
            octetsImages += donnees.length;
            if (octetsImages > MAX_OCTETS_IMAGES) return { src };
            const extension = imageDocxValide(donnees, image.contentType);
            if (!extension) return { src };
            // Un échec isolé de stockage ne doit jamais déguiser une image
            // manquante en image conservée : son bloc reste un emplacement.
            const reference = await options.conserverImage(donnees, extension);
            if (reference && analyserImageStudio(reference)) references.set(numero, reference);
          } catch {
            // Le rapport marque l'image comme non conservée.
          }
          return { src };
        }),
      },
    );
    html = resultat.value;
  } catch {
    throw new ImportRefuse(
      "Ce fichier Word n'a pas pu être lu. S'il date d'une ancienne version (.doc), " +
        "enregistrez-le au format .docx avant de le déposer.",
    );
  }

  const { blocs, images } = lireHtmlSimple(html, references);

  if (blocs.length === 0) {
    throw new ImportRefuse("Ce document ne contient aucun texte.");
  }

  const alertes: AlerteConversion[] = [];
  const absentes = blocs.filter((bloc) => bloc.type === "image" && bloc.fileId === null).length;
  if (absentes > 0) {
    alertes.push({
      gravite: "verifier",
      message:
        absentes === 1
          ? "Une image du document n'a pas été reprise : sa place est marquée, à vous de la remettre."
          : `${absentes} images du document n'ont pas été reprises : leur place est marquée, à vous de les remettre.`,
    });
    // CONV-10 : chaque image absente est signalée, avec ce qui la précède,
    // pour la retrouver dans l'original et la remettre à sa place.
    let rang = 0;
    blocs.forEach((bloc, i) => {
      if (bloc.type !== "image") return;
      rang += 1;
      if (bloc.fileId !== null) return;
      const avant = blocs.slice(0, i).reverse().find((b) => b.type === "titre" || b.type === "paragraphe");
      const repere = avant && "texte" in avant ? ` (après « ${avant.texte.slice(0, 60)}${avant.texte.length > 60 ? "…" : ""} »)` : " (en tête du document)";
      alertes.push({ gravite: "verifier", message: `Image ${rang} sur ${images}${repere} : à remettre depuis votre fichier d'origine.` });
    });
  }

  return {
    version: VERSION_DOCUMENT,
    titre: titreProbable(blocs),
    blocs,
    format: "docx",
    rapport: { pagesLues: 0, blocsExtraits: blocs.length, imagesConservees: images - absentes, alertes },
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
function lireHtmlSimple(html: string, references: ReadonlyMap<number, string>): { blocs: BlocCours[]; images: number } {
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

  const placerImages = (fragment: string) => {
    for (const balise of fragment.match(/<img\b[^>]*>/gi) ?? []) {
      images += 1;
      // Seule une référence issue du callback interne de Mammoth est reprise.
      // Aucun attribut HTML, chemin ou URL du document n'est rendu tel quel.
      const identifiant = /\bsrc="study-image-(\d+)"/i.exec(balise);
      const reference = identifiant ? references.get(Number(identifiant[1])) ?? null : null;
      blocs.push({ type: "image", fileId: reference, alt: `Image ${images} du document d'origine` });
    }
  };

  for (const trouve of html.matchAll(motif)) {
    const balise = (trouve[1] ?? trouve[3] ?? "").toLowerCase();

    if (balise === "img") {
      viderListe();
      placerImages(trouve[0]);
      continue;
    }

    // Mammoth place une image dans son paragraphe (« <p><img/></p> ») : elle
    // disparaissait avec le balisage. Chaque image garde maintenant sa place,
    // juste après le texte qui l'accompagne.
    const imagesIncluses = (trouve[2] ?? "").match(/<img\b/gi)?.length ?? 0;

    const texte = nettoyer(trouve[2] ?? "");
    if (texte === "") {
      if (imagesIncluses > 0) {
        viderListe();
        placerImages(trouve[2] ?? "");
      }
      continue;
    }
    if (imagesIncluses > 0 && balise !== "li" && balise !== "table") {
      viderListe();
      const avant = blocs.length;
      blocs.push({ type: "paragraphe", texte });
      if (balise.startsWith("h")) {
        const niveau = Number(balise.slice(1));
        blocs[avant] = { type: "titre", niveau: (niveau <= 1 ? 1 : niveau === 2 ? 2 : 3) as NiveauTitre, texte };
      }
      placerImages(trouve[2] ?? "");
      continue;
    }

    if (balise === "li") {
      listeEnCours ??= [];
      listeEnCours.push(texte);
      if (imagesIncluses > 0) {
        viderListe();
        placerImages(trouve[2] ?? "");
      }
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
      // Une image insérée dans une cellule est rendue sous le tableau ; elle
      // n'est jamais perdue silencieusement, même sans éditeur de cellules.
      if (imagesIncluses > 0) placerImages(trouve[2] ?? "");
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
const EXPOSANTS: Record<string, string> = { "0": "⁰", "1": "¹", "2": "²", "3": "³", "4": "⁴", "5": "⁵", "6": "⁶", "7": "⁷", "8": "⁸", "9": "⁹", "+": "⁺", "-": "⁻", "−": "⁻", "=": "⁼", "(": "⁽", ")": "⁾", n: "ⁿ", i: "ⁱ" };
const INDICES: Record<string, string> = { "0": "₀", "1": "₁", "2": "₂", "3": "₃", "4": "₄", "5": "₅", "6": "₆", "7": "₇", "8": "₈", "9": "₉", "+": "₊", "-": "₋", "−": "₋", "=": "₌", "(": "₍", ")": "₎" };

/**
 * Exposant ou indice Word (CONV-07) : en caractères Unicode quand ils
 * existent (x², H₂O, m·s⁻²), sinon noté ^(…) ou _(…) — jamais « x 2 ».
 */
function decaler(texte: string, table: Record<string, string>, repli: string): string {
  const brut = texte.replace(/<[^>]*>/g, "").trim();
  if (brut === "") return "";
  return [...brut].every((c) => c in table) ? [...brut].map((c) => table[c]).join("") : `${repli}(${brut})`;
}

function nettoyer(fragment: string): string {
  return fragment
    .replace(/<sup\b[^>]*>([\s\S]*?)<\/sup>/gi, (_, x: string) => decaler(x, EXPOSANTS, "^"))
    .replace(/<sub\b[^>]*>([\s\S]*?)<\/sub>/gi, (_, x: string) => decaler(x, INDICES, "_"))
    // Les balises de mise en forme ne séparent pas les mots : « pré<strong>fixe</strong> ».
    .replace(/<\/?(strong|em|b|i|u|s|a|span)\b[^>]*>/gi, "")
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
export async function extraire(octets: Buffer, options: OptionsExtraction = {}): Promise<DocumentCours> {
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

  return format === "pdf" ? extrairePdf(octets, options) : extraireDocx(octets, options);
}
