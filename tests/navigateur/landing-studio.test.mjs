import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test, { after } from "node:test";
import { BASE, fermerNavigateur, ouvrirNavigateur } from "./harness.mjs";

after(fermerNavigateur);
test("la vitrine ouvre l’inscription et livre le vrai PDF, sur ordinateur et à 390 px", async (t) => {
  const navigateur = await ouvrirNavigateur();
  for (const largeur of [1280, 390]) {
    await t.test(`largeur ${largeur} px`, async () => {
      const page = await navigateur.newPage({ viewport: { width: largeur, height: 900 }, reducedMotion: "reduce" });
      page.setDefaultTimeout(60_000);
      try {
        await page.goto(BASE, { waitUntil: "domcontentloaded", timeout: 120_000 });
        await page.getByRole("heading", { name: "Tu veux travailler quoi aujourd’hui ?" }).waitFor();
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
        const inscription = await page.getByRole("contentinfo").getByRole("link", { name: "Créer un compte prof" }).getAttribute("href");
        const exemple = await page.getByRole("contentinfo").getByRole("link", { name: "Voir un avant/après" }).getAttribute("href");
        assert.equal(inscription, "/inscription/professeur");
        assert.equal(exemple, "/exemple-pdf");
        await page.goto(new URL(inscription, BASE).href, { waitUntil: "domcontentloaded", timeout: 120_000 });
        await page.getByRole("heading", { name: "Crée ton espace professeur." }).waitFor();
        await page.goto(new URL(exemple, BASE).href, { waitUntil: "domcontentloaded", timeout: 120_000 });
        await page.getByRole("heading", { name: "Après", exact: true }).waitFor();
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
        const [fichier] = await Promise.all([
          page.waitForEvent("download"),
          page.getByRole("link", { name: "Télécharger le PDF modernisé" }).click(),
        ]);
        const octets = await readFile(await fichier.path());
        assert.equal(octets.subarray(0, 5).toString(), "%PDF-");
        assert.equal(fichier.suggestedFilename(), "fonctions-affines-modernise.pdf");
      } finally {
        await page.close();
      }
    });
  }
});
