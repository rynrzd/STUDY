import test from "node:test";
import assert from "node:assert/strict";
import { extractText, getDocumentProxy } from "unpdf";
import { fabriquerPdfCours, nomPdf } from "../../src/lib/export-pdf.ts";
import { REGLAGES_PAR_DEFAUT, type DocumentCours } from "../../src/lib/document-cours.ts";

const cours: DocumentCours = {
  version: 1,
  titre: "Énergie et systèmes corrigés",
  format: "pdf",
  rapport: { pagesLues: 2, blocsExtraits: 3, imagesConservees: 0, alertes: [] },
  blocs: [
    { type: "titre", niveau: 1, texte: "Définition", origine: { page: 1 } },
    { type: "paragraphe", texte: "L’énergie se conserve : entrée, stockage et sortie.", origine: { page: 1 } },
    { type: "liste", ordonnee: false, elements: ["Mesurer la puissance", "Comparer les rendements"], origine: { page: 2 } },
  ],
};

test("PDF direct : A4, titre corrigé, accents et texte sélectionnable", async () => {
  const octets = await fabriquerPdfCours(cours, REGLAGES_PAR_DEFAUT);
  assert.equal(octets.subarray(0, 5).toString("ascii"), "%PDF-");
  const pdf = await getDocumentProxy(new Uint8Array(octets));
  const page = await pdf.getPage(1);
  const vue = page.getViewport({ scale: 1 });
  assert.ok(Math.abs(vue.width - 595.28) < 1);
  assert.ok(Math.abs(vue.height - 841.89) < 1);
  const extrait = await extractText(pdf, { mergePages: true });
  assert.match(String(extrait.text), /Énergie et systèmes corrigés/u);
  assert.match(String(extrait.text), /L’énergie se conserve/u);
});

test("le nom du PDF ne peut pas devenir un chemin", () => {
  assert.equal(nomPdf(" ../Cours : énergie? "), ".. Cours énergie.pdf");
});
