// Lancer contre « npm run dev » : l'aperçu fictif est réservé au développement.
import assert from "node:assert/strict";
import { fermerNavigateur, page } from "../../tests/navigateur/harness.mjs";

try {
  const onglet = await page("/apercu/espaces?espace=professeur", { largeur: 1366, hauteur: 768 });
  await onglet.emulateMedia({ reducedMotion: "reduce" });
  const rail = onglet.locator(".app-barre");
  const espace = onglet.locator(".app-espace");
  const bascule = onglet.locator(".replier-barre");
  for (const largeur of [320, 375, 390, 430, 768, 1024, 1099, 1100, 1280, 1366, 1440]) {
    await onglet.setViewportSize({ width: largeur, height: 768 });
    for (let etat = 0; etat < (largeur >= 1100 ? 2 : 1); etat++) {
      const barre = await rail.boundingBox();
      const contenu = await espace.boundingBox();
      assert.ok(contenu);
      if (barre) {
        assert.ok(contenu.x >= barre.x + barre.width - 1, `Chevauchement à ${largeur} px`);
        assert.ok(contenu.x - barre.x - barre.width <= 20, `Marge excessive à ${largeur} px`);
      } else {
        assert.equal(contenu.x, 0);
      }
      const dimensions = await onglet.evaluate(() => ({
        visible: document.documentElement.clientWidth,
        page: document.documentElement.scrollWidth,
      }));
      assert.ok(Math.abs(contenu.x + contenu.width - dimensions.visible) <= 1);
      assert.ok(dimensions.page <= dimensions.visible, `Débordement à ${largeur} px`);
      if (largeur >= 1100) await bascule.click();
    }
  }
} finally {
  await fermerNavigateur();
}
