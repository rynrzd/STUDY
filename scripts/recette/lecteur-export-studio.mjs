import assert from "node:assert/strict";
import { fermerNavigateur, page } from "../../tests/navigateur/harness.mjs";

// L'écran fictif T07 utilise le même lecteur et un PDF local de deux pages.
try {
  const onglet = await page("/apercu/ecrans?ecran=T07", { largeur: 390, hauteur: 844 });
  const lien = onglet.getByRole("link", { name: "Télécharger Cours — fonctions affines.pdf" });
  const adresse = await lien.getAttribute("href");
  assert.equal(adresse, "/apercu/pdf-exemple");
  const fichier = await onglet.request.get(new URL(adresse, onglet.url()).href);
  assert.equal(fichier.status(), 200);
  assert.equal((await fichier.body()).subarray(0, 5).toString(), "%PDF-");
  await onglet.getByRole("img", { name: /Page 1 sur 2 du document/ }).waitFor();
  await onglet.getByRole("button", { name: "Page suivante" }).click();
  await onglet.getByRole("img", { name: /Page 2 sur 2 du document/ }).waitFor();
} finally {
  await fermerNavigateur();
}
