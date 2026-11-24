import "server-only";

import { createRequire } from "node:module";
import path from "node:path";
import PDFDocument from "pdfkit";
import { sommaire, type BlocCours, type DocumentCours, type ReglagesPresentation } from "./document-cours.ts";

const require = createRequire(import.meta.url);
const dossierPolices = path.dirname(require.resolve("dejavu-fonts-ttf/package.json"));
const POLICE_REGULIERE = path.join(dossierPolices, "ttf", "DejaVuSans.ttf");
const POLICE_GRASSE = path.join(dossierPolices, "ttf", "DejaVuSans-Bold.ttf");

const LARGEUR_A4 = 595.28;
const HAUTEUR_A4 = 841.89;
const MARGE = 48;
const COULEUR_TEXTE = "#17151a";
const COULEUR_ACCENT = "#9b315f";
const COULEUR_DOUCE = "#f8edf2";

/** Nom d'une pièce jointe : lisible, borné et sans séparateur de chemin. */
export function nomPdf(titre: string): string {
  const base = titre
    .normalize("NFKC")
    .replace(/[\\/:*?"<>|\u0000-\u001f]/gu, " ")
    .replace(/\s+/gu, " ")
    .trim()
    .slice(0, 100);
  return `${base || "cours"}.pdf`;
}

/**
 * Produit le fichier A4 directement depuis la révision affichée.
 *
 * La police est embarquée : les accents restent sélectionnables et le rendu
 * ne dépend pas des polices installées sur le serveur. PDFKit gère la
 * pagination, puis les numéros de page sont ajoutés dans un second passage.
 */
export async function fabriquerPdfCours(
  document: DocumentCours,
  reglages: ReglagesPresentation,
): Promise<Buffer> {
  const pdf = new PDFDocument({
    size: "A4",
    margins: { top: MARGE, right: MARGE, bottom: MARGE + 16, left: MARGE },
    bufferPages: true,
    info: { Title: document.titre, Creator: "AvecStudy Studio" },
  });
  pdf.registerFont("AvecStudy", POLICE_REGULIERE);
  pdf.registerFont("AvecStudy Gras", POLICE_GRASSE);
  pdf.font("AvecStudy").fillColor(COULEUR_TEXTE);

  const morceaux: Buffer[] = [];
  pdf.on("data", (morceau: Buffer) => morceaux.push(morceau));
  const fini = new Promise<Buffer>((resolve, reject) => {
    pdf.once("end", () => resolve(Buffer.concat(morceaux)));
    pdf.once("error", reject);
  });

  pdf.font("AvecStudy Gras").fontSize(24 * reglages.taille).text(document.titre, {
    lineGap: 2,
  });
  pdf.moveDown(0.35);
  pdf.strokeColor("#dca7be").lineWidth(1).moveTo(MARGE, pdf.y).lineTo(LARGEUR_A4 - MARGE, pdf.y).stroke();
  pdf.moveDown(0.8);

  if (reglages.sommaire) dessinerSommaire(pdf, document, reglages);
  for (const bloc of document.blocs) dessinerBloc(pdf, bloc, reglages);

  if (reglages.numerosDePage) {
    const pages = pdf.bufferedPageRange();
    for (let index = pages.start; index < pages.start + pages.count; index += 1) {
      pdf.switchToPage(index);
      pdf
        .font("AvecStudy")
        .fontSize(8)
        .fillColor("#6e6872")
        .text(String(index - pages.start + 1), MARGE, HAUTEUR_A4 - 38, {
          width: LARGEUR_A4 - MARGE * 2,
          align: "center",
          lineBreak: false,
        });
    }
  }

  pdf.end();
  return fini;
}

function dessinerSommaire(pdf: PDFKit.PDFDocument, document: DocumentCours, reglages: ReglagesPresentation) {
  const entrees = sommaire(document);
  if (entrees.length === 0) return;
  assurerPlace(pdf, 46 + entrees.length * 18);
  const haut = pdf.y;
  const hauteur = 34 + entrees.length * 17;
  pdf.roundedRect(MARGE, haut, LARGEUR_A4 - MARGE * 2, hauteur, 5).fill(COULEUR_DOUCE);
  pdf.fillColor(COULEUR_ACCENT).font("AvecStudy Gras").fontSize(9).text("SOMMAIRE", MARGE + 14, haut + 11);
  let y = haut + 29;
  for (const entree of entrees) {
    pdf
      .fillColor(COULEUR_TEXTE)
      .font("AvecStudy")
      .fontSize(10 * reglages.taille)
      .text(entree.texte, MARGE + 14 + (entree.niveau - 1) * 14, y, {
        width: LARGEUR_A4 - MARGE * 2 - 28 - (entree.niveau - 1) * 14,
        lineBreak: false,
        ellipsis: true,
      });
    y += 17;
  }
  pdf.y = haut + hauteur + 16;
}

function dessinerBloc(pdf: PDFKit.PDFDocument, bloc: BlocCours, reglages: ReglagesPresentation) {
  const corps = 11 * reglages.taille;
  const interligne = Math.max(1, (reglages.interligne - 1) * corps);
  const options = { width: LARGEUR_A4 - MARGE * 2, lineGap: interligne };

  switch (bloc.type) {
    case "titre": {
      const taille = (bloc.niveau === 1 ? 17 : bloc.niveau === 2 ? 14 : 12) * reglages.taille;
      assurerPlace(pdf, taille * 2.2);
      pdf.moveDown(bloc.niveau === 1 ? 0.65 : 0.35).font("AvecStudy Gras").fontSize(taille).fillColor(COULEUR_TEXTE).text(bloc.texte, options);
      pdf.moveDown(0.35);
      return;
    }
    case "paragraphe":
    case "brut":
      pdf.font("AvecStudy").fontSize(corps).fillColor(bloc.type === "brut" ? "#615b65" : COULEUR_TEXTE).text(bloc.texte, options).moveDown(0.65);
      return;
    case "encadre": {
      pdf.font("AvecStudy").fontSize(corps);
      const largeur = LARGEUR_A4 - MARGE * 2 - 24;
      const hauteurTexte = pdf.heightOfString(bloc.texte, { width: largeur, lineGap: interligne });
      const hauteur = 37 + hauteurTexte;
      assurerPlace(pdf, Math.min(hauteur, HAUTEUR_A4 - MARGE * 2));
      const haut = pdf.y;
      pdf.roundedRect(MARGE, haut, LARGEUR_A4 - MARGE * 2, hauteur, 5).fill(COULEUR_DOUCE);
      pdf.fillColor(COULEUR_ACCENT).font("AvecStudy Gras").fontSize(9).text(bloc.intitule.toLocaleUpperCase("fr-FR"), MARGE + 12, haut + 10, { lineBreak: false });
      pdf.fillColor(COULEUR_TEXTE).font("AvecStudy").fontSize(corps).text(bloc.texte, MARGE + 12, haut + 27, { width: largeur, lineGap: interligne });
      pdf.y = haut + hauteur + 12;
      return;
    }
    case "liste":
      bloc.elements.forEach((element, index) => {
        const marque = bloc.ordonnee ? `${index + 1}.` : "•";
        assurerPlace(pdf, corps * 2.4);
        const haut = pdf.y;
        pdf.font("AvecStudy Gras").fontSize(corps).fillColor(COULEUR_ACCENT).text(marque, MARGE, haut, { width: 22, lineBreak: false });
        pdf.font("AvecStudy").fillColor(COULEUR_TEXTE).text(element, MARGE + 25, haut, { width: LARGEUR_A4 - MARGE * 2 - 25, lineGap: interligne });
        pdf.moveDown(0.25);
      });
      pdf.moveDown(0.4);
      return;
    case "tableau":
      dessinerTableau(pdf, bloc, corps);
      pdf.moveDown(0.7);
      return;
    case "image": {
      assurerPlace(pdf, 92);
      const haut = pdf.y;
      pdf.save().dash(4, { space: 3 }).strokeColor("#aaa3ad").roundedRect(MARGE, haut, LARGEUR_A4 - MARGE * 2, 76, 5).stroke().restore();
      pdf.font("AvecStudy").fontSize(9).fillColor("#6e6872").text(bloc.legende ?? bloc.alt ?? "Image à reprendre depuis l'original", MARGE + 16, haut + 28, { width: LARGEUR_A4 - MARGE * 2 - 32, align: "center" });
      pdf.y = haut + 88;
      return;
    }
  }
}

function dessinerTableau(pdf: PDFKit.PDFDocument, bloc: Extract<BlocCours, { type: "tableau" }>, taille: number) {
  const colonnes = Math.max(1, bloc.entetes.length, ...bloc.lignes.map((ligne) => ligne.length));
  const largeurTotale = LARGEUR_A4 - MARGE * 2;
  const largeur = largeurTotale / colonnes;
  const lignes = [bloc.entetes, ...bloc.lignes];
  lignes.forEach((ligne, index) => {
    pdf.font(index === 0 ? "AvecStudy Gras" : "AvecStudy").fontSize(Math.min(taille, 9.5));
    const hauteurs = Array.from({ length: colonnes }, (_, colonne) =>
      pdf.heightOfString(ligne[colonne] ?? "", { width: largeur - 12, lineGap: 2 }),
    );
    const hauteur = Math.max(28, ...hauteurs) + 10;
    assurerPlace(pdf, hauteur);
    const haut = pdf.y;
    if (index === 0) pdf.rect(MARGE, haut, largeurTotale, hauteur).fill("#f1dce5");
    for (let colonne = 0; colonne < colonnes; colonne += 1) {
      const gauche = MARGE + colonne * largeur;
      pdf.strokeColor("#cfc8d1").lineWidth(0.6).rect(gauche, haut, largeur, hauteur).stroke();
      pdf.fillColor(COULEUR_TEXTE).text(ligne[colonne] ?? "", gauche + 6, haut + 7, { width: largeur - 12, lineGap: 2 });
    }
    pdf.y = haut + hauteur;
  });
}

function assurerPlace(pdf: PDFKit.PDFDocument, hauteur: number) {
  if (pdf.y + hauteur > HAUTEUR_A4 - MARGE - 16) pdf.addPage();
}
