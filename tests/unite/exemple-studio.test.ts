import assert from "node:assert/strict";
import test from "node:test";
import { extractText, getDocumentProxy } from "unpdf";
import { exempleStudio, pdfModerniseExemple, pdfOriginalExemple, textesExemple } from "../../src/lib/exemple-studio.ts";

test("la vitrine transforme un original PDF fictif de deux pages en PDF A4 sélectionnable", async () => {
  const original = await pdfOriginalExemple();
  const pages = await textesExemple(original);
  assert.equal(pages.length, 2);
  assert.match(pages[0]!, /ordonnée à l’origine/);
  assert.match(pages[1]!, /points dans le repère/);
  assert.equal((await exempleStudio(original)).rapport.pagesLues, 2);

  const resultat = await pdfModerniseExemple();
  const pdf = await getDocumentProxy(new Uint8Array(resultat));
  try {
    const [gauche = 0, bas = 0, droite = 0, haut = 0] = (await pdf.getPage(1)).view;
    assert.ok(Math.abs(droite - gauche - 595.28) < 1);
    assert.ok(Math.abs(haut - bas - 841.89) < 1);
    const { text } = await extractText(pdf, { mergePages: true });
    assert.match(text, /Comprendre les fonctions affines/);
    assert.match(text, /f\(x\) = ax \+ b/);
    assert.match(text, /points dans le repère/);
  } finally {
    await pdf.cleanup();
  }
});
