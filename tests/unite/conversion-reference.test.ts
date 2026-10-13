import assert from "node:assert/strict";
import test from "node:test";
import { extraire } from "../../src/lib/extraction.ts";
import { docx, docxBrut, imageEnLigne, pdf } from "./fabriquer-documents.ts";

/**
 * Jeu de référence de conversion — cahier des charges ch. 09 (CONV-07,
 * CONV-10). Ce qui doit traverser l'import sans perte : accents, lettres
 * grecques, symboles, exposants et indices, unités, tableaux, listes ; et
 * chaque image absente, signalée à sa place.
 */

const run = (texte: string, rpr = "") => `<w:r>${rpr ? `<w:rPr>${rpr}</w:rPr>` : ""}<w:t xml:space="preserve">${texte}</w:t></w:r>`;
const exposant = (t: string) => run(t, `<w:vertAlign w:val="superscript"/>`);
const indice = (t: string) => run(t, `<w:vertAlign w:val="subscript"/>`);
const p = (...runs: string[]) => `<w:p>${runs.join("")}</w:p>`;
const texteDe = (blocs: readonly { type: string }[]) => blocs.map((b) => ("texte" in b ? (b as { texte: string }).texte : "")).join("\n");

test("CONV-07 — accents, ligatures, lettres grecques et symboles traversent l'import DOCX", async () => {
  const phrase = "Œuvre, cœur, à côté, Noël, ça — α β γ δ λ μ π σ ω Δ Ω ; ≤ ≥ ≠ ≈ ∞ √ ∑ ∫ ∈ ℝ → ±";
  const doc = await extraire(docx([{ texte: "Chapitre", style: "Heading1" }, { texte: phrase }]));
  assert.ok(texteDe(doc.blocs).includes(phrase));
});

test("CONV-07 — exposants et indices Word deviennent x², H₂O, m·s⁻², jamais « x 2 »", async () => {
  const doc = await extraire(
    docxBrut(
      p(run("Aire : x"), exposant("2"), run(" + y"), exposant("3")) +
        p(run("L'eau H"), indice("2"), run("O et le dioxyde CO"), indice("2")) +
        p(run("g = 9,81 m·s"), exposant("−2"), run(" ; 10"), exposant("-3"), run(" mol·L"), exposant("-1")) +
        p(run("Suite u"), indice("n+1"), run(" et e"), exposant("iπ")),
    ),
  );
  const t = texteDe(doc.blocs);
  assert.match(t, /Aire : x² \+ y³/);
  assert.match(t, /L'eau H₂O et le dioxyde CO₂/);
  assert.match(t, /9,81 m·s⁻² ; 10⁻³ mol·L⁻¹/);
  assert.match(t, /Suite u_\(n\+1\) et e\^\(iπ\)/, "sans équivalent Unicode, une notation explicite");
});

test("CONV-07 — la mise en forme ne coupe pas les mots", async () => {
  const doc = await extraire(docxBrut(p(run("pré"), run("fixe", "<w:b/>"), run(" et "), run("suf", "<w:i/>"), run("fixe"))));
  assert.match(texteDe(doc.blocs), /préfixe et suffixe/);
});

test("CONV-07 — un tableau Word garde ses cellules, entêtes compris", async () => {
  const cellule = (t: string) => `<w:tc><w:p>${run(t)}</w:p></w:tc>`;
  const ligne = (...c: string[]) => `<w:tr>${c.map(cellule).join("")}</w:tr>`;
  const doc = await extraire(docxBrut(p(run("Mesures")) + `<w:tbl>${ligne("Grandeur", "Valeur", "Unité")}${ligne("Masse", "2,5", "kg")}${ligne("Vitesse", "3·10⁸", "m·s⁻¹")}</w:tbl>`));
  const tableau = doc.blocs.find((b) => b.type === "tableau");
  assert.ok(tableau && tableau.type === "tableau");
  assert.deepEqual(tableau.entetes, ["Grandeur", "Valeur", "Unité"]);
  assert.deepEqual(tableau.lignes, [["Masse", "2,5", "kg"], ["Vitesse", "3·10⁸", "m·s⁻¹"]]);
});

test("CONV-07 — un PDF à couche de texte garde ses accents", async () => {
  const doc = await extraire(pdf(["Les fonctions affines", "Definition : une fonction affine", "f(x) = ax + b"]));
  assert.match(texteDe(doc.blocs), /f\(x\) = ax \+ b/);
});

test("CONV-10 — chaque image Word absente est marquée à sa place et signalée une à une", async () => {
  const doc = await extraire(
    docxBrut(
      `<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr>${run("Le cycle de l'eau")}</w:p>` +
        p(run("Observez le schéma ci-dessous.")) +
        p(imageEnLigne(1)) +
        p(run("Puis la photo : "), imageEnLigne(2)),
      2,
    ),
  );
  const images = doc.blocs.filter((b) => b.type === "image");
  assert.equal(images.length, 2, "les deux images gardent leur place (dont celle dans un paragraphe)");
  assert.equal(images.every((b) => b.type === "image" && b.fileId === null), true, "rien n'est inventé");
  const alertes = doc.rapport.alertes.map((a) => a.message);
  assert.ok(alertes.some((m) => /2 images du document n'ont pas été reprises/.test(m)));
  assert.ok(alertes.some((m) => /Image 1 sur 2 \(après « Observez le schéma ci-dessous\. »\)/.test(m)), alertes.join(" | "));
  assert.ok(alertes.some((m) => /Image 2 sur 2 \(après « Puis la photo : ? »\)/.test(m)), alertes.join(" | "));
  // L'ordre est respecté : la première image suit la consigne.
  const i1 = doc.blocs.findIndex((b) => b.type === "image");
  assert.equal((doc.blocs[i1 - 1] as { texte?: string }).texte, "Observez le schéma ci-dessous.");
});
