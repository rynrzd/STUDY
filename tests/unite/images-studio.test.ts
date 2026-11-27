import assert from "node:assert/strict";
import test from "node:test";
import { extraire } from "../../src/lib/extraction.ts";
import { REGLAGES_PAR_DEFAUT, type DocumentCours } from "../../src/lib/document-cours.ts";
import { fabriquerPdfCours } from "../../src/lib/export-pdf.ts";
import {
  analyserImageStudio,
  imageDocxValide,
  imageStudioAuthentique,
  referenceImageStudio,
} from "../../src/lib/images-studio.ts";
import { urlImageStudio } from "../../src/lib/images-studio-reference.ts";
import { docx, docxBrut, imageEnLigne } from "./fabriquer-documents.ts";

const ORGANISATION = "11111111-1111-4111-8111-111111111111";
const DOCUMENT = "22222222-2222-4222-8222-222222222222";
const VERSION = "33333333-3333-4333-8333-333333333333";
const PNG = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==", "base64");
const coursWord = () => docxBrut(
  `<w:p><w:r><w:t>Le cycle de l'eau</w:t></w:r></w:p><w:p>${imageEnLigne(1)}</w:p>` +
  `<w:p><w:r><w:t>Deuxième image</w:t></w:r>${imageEnLigne(2)}</w:p>`,
  2,
);

test("DOCX : chaque PNG récupérable conserve ses octets en privé et sa position", async () => {
  const enregistrees: Buffer[] = [];
  const document = await extraire(coursWord(), {
    conserverImage: async (octets, extension) => {
      enregistrees.push(octets);
      return referenceImageStudio(ORGANISATION, DOCUMENT, octets, extension);
    },
  });
  assert.equal(enregistrees.length, 2);
  assert.ok(enregistrees.every((octets) => octets.equals(PNG)));
  const images = document.blocs.filter((bloc) => bloc.type === "image");
  assert.equal(images.length, 2);
  assert.equal(document.rapport.imagesConservees, 2);
  assert.equal(document.rapport.alertes.length, 0);
  assert.ok(images.every((image) => image.fileId && analyserImageStudio(image.fileId)));
  assert.ok(document.blocs.findIndex((b) => b.type === "image") > 0);
});

test("DOCX : un échec de stockage est visible comme image absente, sans perdre le reste", async () => {
  let appels = 0;
  const document = await extraire(coursWord(), {
    conserverImage: async (octets, extension) => {
      appels += 1;
      if (appels === 1) throw new Error("stockage indisponible");
      return referenceImageStudio(ORGANISATION, DOCUMENT, octets, extension);
    },
  });
  assert.equal(document.rapport.imagesConservees, 1);
  const images = document.blocs.filter((b) => b.type === "image");
  assert.equal(images.length, 2);
  assert.equal(images[0]?.fileId, null);
  assert.ok(images[1]?.fileId);
  assert.match(document.rapport.alertes[0]?.message ?? "", /Une image du document n'a pas été reprise/);
  assert.ok(document.rapport.alertes.some((a) => /Image 1 sur 2/.test(a.message)));
});

test("DOCX : une image dans une cellule n'efface pas la structure du tableau", async () => {
  const tableau = `<w:tbl><w:tr><w:tc><w:p><w:r><w:t>Grandeur</w:t></w:r></w:p></w:tc>` +
    `<w:tc><w:p><w:r><w:t>Schéma</w:t></w:r></w:p></w:tc></w:tr>` +
    `<w:tr><w:tc><w:p><w:r><w:t>Force</w:t></w:r></w:p></w:tc>` +
    `<w:tc><w:p>${imageEnLigne(1)}</w:p></w:tc></w:tr></w:tbl>`;
  const cours = await extraire(docxBrut(`<w:p><w:r><w:t>Physique</w:t></w:r></w:p>${tableau}`, 1), {
    conserverImage: async (octets, ext) => referenceImageStudio(ORGANISATION, DOCUMENT, octets, ext),
  });
  const bloc = cours.blocs.find((b) => b.type === "tableau");
  assert.ok(bloc && bloc.type === "tableau");
  assert.deepEqual(bloc.entetes, ["Grandeur", "Schéma"]);
  assert.equal(cours.blocs.filter((b) => b.type === "image").length, 1);
  assert.equal(cours.rapport.imagesConservees, 1);
});

test("Les références sont strictes, signées par empreinte et ne contiennent pas de data URI", () => {
  assert.equal(imageDocxValide(PNG, "image/png"), "png");
  assert.equal(imageDocxValide(PNG, "image/svg+xml"), null);
  assert.equal(imageDocxValide(Buffer.from("<svg onload=alert(1)/>"), "image/png"), null);
  const reference = referenceImageStudio(ORGANISATION, DOCUMENT, PNG, "png");
  const image = analyserImageStudio(reference);
  assert.ok(image);
  assert.equal(imageStudioAuthentique(PNG, image), true);
  assert.equal(imageStudioAuthentique(Buffer.concat([PNG, Buffer.from("0")]), image), false);
  assert.equal(image.cle, `${ORGANISATION}/${DOCUMENT}/studio-images/${image.empreinte}.png`);
  assert.equal(urlImageStudio(VERSION, reference), `/images-studio/${VERSION}/${reference}`);
  assert.equal(urlImageStudio(VERSION, "javascript:alert(1)"), null);
  assert.equal(urlImageStudio(undefined, reference), null);
});

test("DOCX : le précontrôle du ZIP bloque une bombe avant de décompresser", async () => {
  const fichier = Buffer.from(docx([{ texte: "Cours", style: "Heading1" }]));
  const repertoire = fichier.indexOf(Buffer.from([0x50, 0x4b, 0x01, 0x02]));
  assert.ok(repertoire > 0);
  fichier.writeUInt32LE(121 * 1024 * 1024, repertoire + 24);
  await assert.rejects(
    () => extraire(fichier),
    (erreur: unknown) => erreur instanceof Error && /décompresse en plus de 120 Mo/.test(erreur.message),
  );
});

test("PDF Studio : image récupérée intégrée, sans supprimer le texte ni la légende", async () => {
  const reference = referenceImageStudio(ORGANISATION, DOCUMENT, PNG, "png");
  const cours: DocumentCours = {
    version: 1, format: "docx", titre: "Sciences naturelles",
    blocs: [
      { type: "paragraphe", texte: "Avant le schéma" },
      { type: "image", fileId: reference, alt: "Schéma", legende: "Figure 1" },
      { type: "paragraphe", texte: "Après le schéma" },
    ],
    rapport: { pagesLues: 0, blocsExtraits: 3, imagesConservees: 1, alertes: [] },
  };
  const pdf = await fabriquerPdfCours(cours, REGLAGES_PAR_DEFAUT, async (id) => id === reference ? PNG : null);
  assert.match(pdf.toString("latin1"), /\/Subtype \/Image/);
  assert.ok(!pdf.toString("latin1").includes("data:image/png;base64"));
  const { extractText, getDocumentProxy } = await import("unpdf");
  const document = await getDocumentProxy(new Uint8Array(pdf));
  const { text } = await extractText(document, { mergePages: true });
  assert.match(String(text), /Avant le schéma/);
  assert.match(String(text), /Figure 1/);
  assert.match(String(text), /Après le schéma/);
});
