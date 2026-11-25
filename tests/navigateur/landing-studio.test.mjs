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
        await page.getByRole("heading", { name: "Un ancien PDF. Un cours prêt à partager." }).waitFor();
        assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
        if (largeur === 390) {
          const menu = page.getByText("Menu", { exact: true });
          await menu.focus();
          await page.keyboard.press("Enter");
          await page.locator("header details").getByRole("link", { name: "La plateforme" }).waitFor();
          await page.keyboard.press("Escape");
          assert.ok(await menu.evaluate((noeud) => document.activeElement === noeud));
        }
        await page.getByRole("main").getByRole("link", { name: "Créer un compte prof" }).first().click();
        await page.getByRole("heading", { name: "Crée ton espace professeur." }).waitFor();
        await page.goBack();
        await page.getByRole("main").getByRole("link", { name: "Voir un avant/après" }).click();
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
