import assert from "node:assert/strict";
import test from "node:test";
import {
  ACCEPT_SUPPORTS,
  FORMATS_SUPPORTS,
  nomLisible,
  reconnaitre,
  tailleLisible,
} from "../../src/lib/formats-documents.ts";

/**
 * Reconnaissance des documents déposés — cahier V2, §12.
 *
 * Toute la sécurité du dépôt tient à une phrase : le type est décidé sur les
 * octets, jamais sur le nom. Ces tests existent pour que cette phrase reste
 * vraie quand quelqu'un ajoutera un format.
 */

/** Complète des octets de tête jusqu'à la longueur minimale examinée. */
const avecTete = (...tete: number[]) =>
  Buffer.concat([Buffer.from(tete), Buffer.alloc(32)]);

const PDF = Buffer.concat([Buffer.from("%PDF-1.7\n"), Buffer.alloc(32)]);
const PNG = avecTete(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a);
const JPEG = avecTete(0xff, 0xd8, 0xff, 0xe0);
const ZIP = avecTete(0x50, 0x4b, 0x03, 0x04);

const DOCX = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
const PPTX = "application/vnd.openxmlformats-officedocument.presentationml.presentation";

test("un PDF, un PNG et un JPEG sont reconnus a leur signature", () => {
  assert.equal(reconnaitre(PDF, null)?.mime, "application/pdf");
  assert.equal(reconnaitre(PNG, null)?.mime, "image/png");
  assert.equal(reconnaitre(JPEG, null)?.mime, "image/jpeg");
});

test("le nom du fichier ne fait jamais accepter un contenu refuse", () => {
  // Le cas qui justifie tout le reste : un fichier HTML nomme « cours.pdf »,
  // annonce comme un PDF par le navigateur.
  const html = Buffer.from("<!doctype html><script>alert(1)</script>\n".padEnd(64, " "));
  assert.equal(
    reconnaitre(html, "application/pdf"),
    null,
    "un type declare ne doit jamais l emporter sur les octets",
  );

  const executable = avecTete(0x4d, 0x5a, 0x90, 0x00);
  assert.equal(reconnaitre(executable, "application/pdf"), null);
});

test("un fichier trop court pour porter une signature est refuse", () => {
  assert.equal(reconnaitre(Buffer.from("%PDF"), "application/pdf"), null);
  assert.equal(reconnaitre(Buffer.alloc(0), null), null);
});

test("entre deux formats ZIP, c est le type declare qui departage — ou rien", () => {
  assert.equal(reconnaitre(ZIP, DOCX)?.extension, "docx");
  assert.equal(reconnaitre(ZIP, PPTX)?.extension, "pptx");

  // Sans type declare, on ne devine pas : un .odt ou un .jar ont la meme tete.
  assert.equal(reconnaitre(ZIP, null), null);
  assert.equal(reconnaitre(ZIP, "application/zip"), null);
});

test("le nom d affichage ne peut ni ressembler a un chemin ni casser un en-tete", () => {
  assert.equal(nomLisible("Fiche d'exercices n° 3.pdf", "pdf"), "Fiche d'exercices n° 3.pdf");
  // Les separateurs disparaissent, et ce qui reste (« ....etcpasswd ») perd sa
  // pseudo-extension puis ses points de tete : il ne reste rien de nommable.
  assert.equal(nomLisible("../../etc/passwd", "pdf"), "document.pdf");
  assert.equal(nomLisible("dossier/rapport.pdf", "pdf"), "dossierrapport.pdf");
  assert.equal(nomLisible('guillemet"interdit.docx', "docx"), "guillemetinterdit.docx");
  assert.equal(nomLisible(".pdf", "pdf"), "document.pdf");
  assert.equal(nomLisible("", "png"), "document.png");

  // L'extension servie est celle du type detecte, pas celle du nom d'origine.
  assert.equal(nomLisible("piege.pdf", "png"), "piege.png");
});

test("un nom tres long est borne", () => {
  const resultat = nomLisible(`${"a".repeat(500)}.pdf`, "pdf");
  assert.ok(resultat.length <= 84, `nom de ${resultat.length} caracteres`);
  assert.ok(resultat.endsWith(".pdf"));
});

test("la liste affichee et la liste verifiee sont la meme", () => {
  for (const format of FORMATS_SUPPORTS) {
    assert.ok(
      ACCEPT_SUPPORTS.includes(`.${format.extension}`),
      `${format.extension} est accepte a la verification mais absent du selecteur`,
    );
  }
  assert.equal(ACCEPT_SUPPORTS.split(",").length, FORMATS_SUPPORTS.length);
});

test("les tailles se lisent en francais", () => {
  assert.equal(tailleLisible(512), "512 o");
  assert.equal(tailleLisible(2048), "2 Ko");
  assert.equal(tailleLisible(3_500_000), "3,3 Mo");
});
