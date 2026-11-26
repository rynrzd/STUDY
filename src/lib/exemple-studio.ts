import "server-only";
import PDFDocument from "pdfkit";
import { extractText, getDocumentProxy } from "unpdf";
import { REGLAGES_PAR_DEFAUT } from "./document-cours.ts";
import { extraire } from "./extraction.ts";
import { fabriquerPdfCours } from "./export-pdf.ts";

export const REGLAGES_EXEMPLE = { ...REGLAGES_PAR_DEFAUT, sommaire: true, numerosDePage: true };

export function pdfOriginalExemple(): Promise<Buffer> {
  const pdf = new PDFDocument({ size: "A4", margin: 38, info: { Title: "Fonctions affines - notes de cours" } });
  return new Promise((resolve, reject) => {
    const blocs: Buffer[] = [];
    pdf.on("data", (bloc: Buffer) => blocs.push(bloc));
    pdf.once("end", () => resolve(Buffer.concat(blocs)));
    pdf.once("error", reject);
    pdf.font("Times-Roman").fontSize(11);
    pdf.text("FONCTIONS AFFINES");
    pdf.text("Définition");
    pdf.text("Une fonction affine s’écrit f(x) = ax + b.");
    pdf.text("a désigne le coefficient directeur de la droite.");
    pdf.text("b désigne son ordonnée à l’origine.");
    pdf.moveDown();
    pdf.text("Exemple");
    pdf.text("Pour f(x) = 2x + 1, on obtient f(3) = 7.");
    pdf.addPage();
    pdf.text("Tracer la droite");
    pdf.text("- Calculer les images de deux nombres distincts.");
    pdf.text("- Placer les deux points dans le repère.");
    pdf.text("- Tracer la droite qui passe par ces points.");
    pdf.moveDown();
    pdf.text("Exercice");
    pdf.text("Calculez f(0) et f(2), puis tracez la droite.");
    pdf.end();
  });
}

export async function exempleStudio(original: Buffer) {
  const document = await extraire(original);
  return { ...document, titre: "Comprendre les fonctions affines" };
}

export async function textesExemple(original: Buffer) {
  const pdf = await getDocumentProxy(new Uint8Array(original));
  try {
    return (await extractText(pdf, { mergePages: false })).text;
  } finally {
    await pdf.cleanup();
  }
}

export async function pdfModerniseExemple() {
  return fabriquerPdfCours(await exempleStudio(await pdfOriginalExemple()), REGLAGES_EXEMPLE);
}
