import "server-only";

import path from "node:path";
import PDFDocument from "pdfkit";
import { MAX_IMAGES_DOCX, MAX_OCTETS_IMAGE, MAX_OCTETS_IMAGES } from "./images-studio.ts";
import { sommaire, type BlocCours, type DocumentCours, type ReglagesPresentation } from "./document-cours.ts";

const dossierPolices = path.join(process.cwd(), "node_modules", "dejavu-fonts-ttf");
const POLICE_REGULIERE = path.join(dossierPolices, "ttf", "DejaVuSans.ttf");
const POLICE_GRASSE = path.join(dossierPolices, "ttf", "DejaVuSans-Bold.ttf");

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
  resoudreImage?: (reference: string) => Promise<Buffer | null>,
): Promise<Buffer> {
  const images = new Map<string, Buffer>();
  if (resoudreImage) {
    // No remote URLs, no binary in the JSON body; each reference is resolved
    // server-side with the same per-version authorization as the HTML image.
    const refs = [...new Set(document.blocs
      .filter((bloc): bloc is Extract<BlocCours, { type: "image" }> => bloc.type === "image")
      .map((bloc) => bloc.fileId)
      .filter((id): id is string => id !== null))].slice(0, MAX_IMAGES_DOCX);
    let total = 0;
    for (const reference of refs) {
      try {
        const octets = await resoudreImage(reference);
        if (octets && octets.length <= MAX_OCTETS_IMAGE && total + octets.length <= MAX_OCTETS_IMAGES) {
          images.set(reference, octets);
          total += octets.length;
        }
      } catch {
        // Missing/unsupported source remains visible as a labelled placeholder.
      }
    }
  }
  const pdf = new PDFDocument({
    size: "A4",
    layout: reglages.modele === "projection" ? "landscape" : "portrait",
    margins: { top: MARGE, right: MARGE, bottom: MARGE + 16, left: MARGE },
    bufferPages: true,
    info: { Title: document.titre, Creator: "AvecStudy Studio" },
  });
  const classique = reglages.modele === "classique";
  pdf.registerFont("AvecStudy", classique ? path.join(dossierPolices, "ttf", "DejaVuSerif.ttf") : POLICE_REGULIERE);
  pdf.registerFont("AvecStudy Gras", classique ? path.join(dossierPolices, "ttf", "DejaVuSerif-Bold.ttf") : POLICE_GRASSE);
  pdf.font("AvecStudy").fillColor(COULEUR_TEXTE);

  const morceaux: Buffer[] = [];
  pdf.on("data", (morceau: Buffer) => morceaux.push(morceau));
  const fini = new Promise<Buffer>((resolve, reject) => {
    pdf.once("end", () => resolve(Buffer.concat(morceaux)));
    pdf.once("error", reject);
  });

  pdf.font("AvecStudy Gras").fontSize((reglages.modele === "projection" ? 32 : 24) * reglages.taille);
  if (reglages.modele === "synthese") {
    const largeur = pdf.page.width - 2 * MARGE;
    const hauteur = pdf.heightOfString(document.titre, { width: largeur - 24 }) + 24;
    pdf.rect(MARGE, MARGE, largeur, hauteur).fill("#69374a");
    pdf.fillColor("#ffffff").text(document.titre, MARGE + 12, MARGE + 12, { width: largeur - 24 });
    pdf.x = MARGE;
    pdf.moveDown();
  } else {
    pdf.text(document.titre, { lineGap: 2 });
  }
  pdf.moveDown(0.35);
  pdf.strokeColor("#dca7be").lineWidth(1).moveTo(MARGE, pdf.y).lineTo(pdf.page.width - MARGE, pdf.y).stroke();
  pdf.moveDown(0.8);

  if (reglages.sommaire) dessinerSommaire(pdf, document, reglages);
  for (const [index, bloc] of document.blocs.entries()) {
    // L'extracteur retrouve souvent le titre dans le premier bloc. Il est
    // déjà dessiné en couverture : le répéter donnait deux titres identiques
    // l'un sous l'autre et faisait croire à une transformation inchangée.
    if (index === 0 && bloc.type === "titre" && bloc.texte.trim() === document.titre.trim()) continue;
    if (reglages.modele === "projection" && index > 0 && bloc.type === "titre" && bloc.niveau === 1) pdf.addPage();
    pdf.x = MARGE;
    dessinerBloc(pdf, bloc, reglages, images);
  }

  const pages = pdf.bufferedPageRange();
  for (let index = pages.start; index < pages.start + pages.count; index += 1) {
    pdf.switchToPage(index);
    const largeur = pdf.page.width;
    const hauteur = pdf.page.height;
    pdf.save();
    pdf.fillColor(COULEUR_ACCENT).font("AvecStudy Gras").fontSize(8)
      .text("AVECSTUDY · COURS", MARGE, 20, { lineBreak: false });
    pdf.strokeColor("#e8d4dc").lineWidth(0.5).moveTo(MARGE, hauteur - 51).lineTo(largeur - MARGE, hauteur - 51).stroke();
    if (reglages.numerosDePage) {
      const numero = `${index - pages.start + 1} / ${pages.count}`;
      pdf.font("AvecStudy Gras").fontSize(8).fillColor(COULEUR_ACCENT);
      // Donner `width` à PDFKit réactive sa pagination jusque dans le pied
      // de page. On place la ligne par sa largeur mesurée, sans largeur active.
      pdf.text(numero, (largeur - pdf.widthOfString(numero)) / 2, hauteur - 38, { lineBreak: false });
    }
    pdf.restore();
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
  pdf.roundedRect(MARGE, haut, pdf.page.width - MARGE * 2, hauteur, 5).fill(COULEUR_DOUCE);
  pdf.fillColor(COULEUR_ACCENT).font("AvecStudy Gras").fontSize(9).text("SOMMAIRE", MARGE + 14, haut + 11);
  let y = haut + 29;
  for (const entree of entrees) {
    pdf
      .fillColor(COULEUR_TEXTE)
      .font("AvecStudy")
      .fontSize(10 * reglages.taille)
      .text(entree.texte, MARGE + 14 + (entree.niveau - 1) * 14, y, {
        width: pdf.page.width - MARGE * 2 - 28 - (entree.niveau - 1) * 14,
        lineBreak: false,
        ellipsis: true,
      });
    y += 17;
  }
  pdf.y = haut + hauteur + 16;
}

function dessinerBloc(pdf: PDFKit.PDFDocument, bloc: BlocCours, reglages: ReglagesPresentation, images: ReadonlyMap<string, Buffer>) {
  const corps = (reglages.modele === "projection" ? 18 : reglages.modele === "aere" ? 13 : 11) * reglages.taille;
  const interligne = Math.max(1, (reglages.interligne - 1) * corps);
  const options = { width: pdf.page.width - MARGE * 2, lineGap: interligne };

  switch (bloc.type) {
    case "titre": {
      const taille = (bloc.niveau === 1 ? 17 : bloc.niveau === 2 ? 14 : 12) * reglages.taille;
      assurerPlace(pdf, taille * 2.2);
      pdf.moveDown(bloc.niveau === 1 ? 0.65 : 0.35);
      if (reglages.modele === "fiche") {
        pdf.font("AvecStudy Gras").fontSize(taille);
        const largeur = pdf.page.width - MARGE * 2;
        const hauteur = pdf.heightOfString(bloc.texte, { width: largeur - 30 }) + 18;
        assurerPlace(pdf, hauteur + 14);
        const y = pdf.y;
        pdf.roundedRect(MARGE, y, largeur, hauteur, 5).fill(COULEUR_DOUCE);
        pdf.rect(MARGE, y, 4, hauteur).fill(COULEUR_ACCENT);
        pdf.fillColor(COULEUR_ACCENT).text(bloc.texte, MARGE + 15, y + 8, { width: largeur - 30 });
        pdf.y = y + hauteur + 12;
        return;
      }
      pdf.font("AvecStudy Gras").fontSize(taille)
        .fillColor(reglages.modele === "classique" ? COULEUR_TEXTE : COULEUR_ACCENT).text(bloc.texte, options);
      if (reglages.modele === "synthese" && bloc.niveau <= 2) {
        const y = pdf.y + 3;
        pdf.strokeColor("#dfa5bd").lineWidth(1).moveTo(MARGE, y).lineTo(MARGE + 84, y).stroke();
        pdf.y = y + 6;
      }
      pdf.moveDown(reglages.modele === "aere" ? 0.8 : 0.35);
      return;
    }
    case "paragraphe":
    case "brut":
      pdf.font("AvecStudy").fontSize(corps).fillColor(bloc.type === "brut" ? "#615b65" : COULEUR_TEXTE).text(bloc.texte, options).moveDown(reglages.modele === "aere" ? 1.1 : 0.65);
      return;
    case "encadre": {
      pdf.font("AvecStudy").fontSize(corps);
      const largeur = pdf.page.width - MARGE * 2 - 24;
      const hauteurTexte = pdf.heightOfString(bloc.texte, { width: largeur, lineGap: interligne });
      const hauteur = 37 + hauteurTexte;
      // Une définition très longue doit traverser les pages. Une seule carte
      // pleine hauteur sortait de la feuille et masquait la fin de la phrase.
      if (hauteur > pdf.page.height - MARGE * 2 - 32) {
        assurerPlace(pdf, 55);
        pdf.fillColor(COULEUR_ACCENT).font("AvecStudy Gras").fontSize(10 * reglages.taille)
          .text(bloc.intitule, options);
        pdf.moveDown(0.25);
        pdf.fillColor(COULEUR_TEXTE).font("AvecStudy").fontSize(corps)
          .text(bloc.texte, options).moveDown(0.8);
        return;
      }
      assurerPlace(pdf, Math.min(hauteur, pdf.page.height - MARGE * 2));
      const haut = pdf.y;
      pdf.roundedRect(MARGE, haut, pdf.page.width - MARGE * 2, hauteur, 5).fill(COULEUR_DOUCE);
      if (reglages.modele === "fiche") pdf.rect(MARGE, haut, 3, hauteur).fill(COULEUR_ACCENT);
      pdf.fillColor(COULEUR_ACCENT).font("AvecStudy Gras").fontSize(9).text(bloc.intitule, MARGE + 12, haut + 10, { lineBreak: false });
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
        pdf.font("AvecStudy").fillColor(COULEUR_TEXTE).text(element, MARGE + 25, haut, { width: pdf.page.width - MARGE * 2 - 25, lineGap: interligne });
        pdf.moveDown(0.25);
      });
      pdf.moveDown(0.4);
      return;
    case "tableau":
      dessinerTableau(pdf, bloc, corps);
      pdf.moveDown(0.7);
      return;
    case "image": {
      const octets = bloc.fileId ? images.get(bloc.fileId) : undefined;
      if (octets) {
        try {
          const largeurMax = pdf.page.width - MARGE * 2;
          const hauteurMax = Math.min(250, pdf.page.height - MARGE * 2 - 32);
          assurerPlace(pdf, hauteurMax + 26);
          const haut = pdf.y;
          pdf.image(octets, MARGE, haut, { fit: [largeurMax, hauteurMax], align: "center", valign: "center" });
          pdf.y = haut + hauteurMax + 10;
          if (bloc.legende) {
            pdf.font("AvecStudy").fontSize(9).fillColor("#6e6872")
              .text(bloc.legende, { width: largeurMax, align: "center" });
            pdf.moveDown(0.5);
          }
          return;
        } catch {
          // Invalid image stream: never abort the whole course export.
        }
      }
      assurerPlace(pdf, 92);
      const haut = pdf.y;
      pdf.save().dash(4, { space: 3 }).strokeColor("#aaa3ad").roundedRect(MARGE, haut, pdf.page.width - MARGE * 2, 76, 5).stroke().restore();
      pdf.font("AvecStudy").fontSize(9).fillColor("#6e6872").text(bloc.legende ?? bloc.alt ?? "Image à reprendre depuis l'original", MARGE + 16, haut + 28, { width: pdf.page.width - MARGE * 2 - 32, align: "center" });
      pdf.y = haut + 88;
      return;
    }
  }
}

function dessinerTableau(pdf: PDFKit.PDFDocument, bloc: Extract<BlocCours, { type: "tableau" }>, taille: number) {
  const colonnes = Math.max(1, bloc.entetes.length, ...bloc.lignes.map((ligne) => ligne.length));
  const largeurTotale = pdf.page.width - MARGE * 2;
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
    else if (index % 2 === 0) pdf.rect(MARGE, haut, largeurTotale, hauteur).fill("#fcf8fa");
    for (let colonne = 0; colonne < colonnes; colonne += 1) {
      const gauche = MARGE + colonne * largeur;
      pdf.strokeColor("#cfc8d1").lineWidth(0.6).rect(gauche, haut, largeur, hauteur).stroke();
      pdf.fillColor(COULEUR_TEXTE).text(ligne[colonne] ?? "", gauche + 6, haut + 7, { width: largeur - 12, lineGap: 2 });
    }
    pdf.y = haut + hauteur;
  });
}

function assurerPlace(pdf: PDFKit.PDFDocument, hauteur: number) {
  if (pdf.y + hauteur > pdf.page.height - MARGE - 16) pdf.addPage();
}
