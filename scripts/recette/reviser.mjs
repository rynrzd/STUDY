import assert from "node:assert/strict";
import { readFile, mkdir } from "node:fs/promises";
import path from "node:path";
import { connecter, ouvrirNavigateur } from "./navigateur.mjs";

// Les accès et identifiants des objets vivent dans un fichier privé hors dépôt.
// À lancer avec scripts/recette-isolee/lancer.mjs après préparation du terrain.
const base = process.env.SITE_BASE;
if (process.env.APP_ENV !== "recette" || !base || !["localhost", "127.0.0.1"].includes(new URL(base).hostname)) {
  throw new Error("Une origine locale et APP_ENV=recette sont requis.");
}
const fichier = process.env.REVISER_ACCES;
if (!fichier || path.resolve(fichier).startsWith(path.resolve(".") + path.sep)) {
  throw new Error("REVISER_ACCES doit désigner le fichier privé de recette hors du dépôt.");
}
const acces = JSON.parse(await readFile(fichier, "utf8"));
for (const role of ["professeur", "lina", "temoin"]) {
  assert.ok(acces[role]?.code && acces[role]?.login && acces[role]?.motDePasse, "Accès de recette incomplets.");
}
assert.match(acces.devoir, /^[0-9a-f-]{36}$/i);
await mkdir("tests/tmp/reviser", { recursive: true });
const navigateur = await ouvrirNavigateur();
try {
  const prof = await navigateur.newContext();
  const pageProf = await prof.newPage();
  await connecter(pageProf, base, acces.professeur);
  await pageProf.goto(`${base}/professeur`);
  await pageProf.screenshot({ path: "tests/tmp/reviser/05-classes.png", fullPage: true });
  await pageProf.goto(`${base}/professeur/devoirs/${acces.devoir}`);
  await pageProf.getByRole("heading", { name: "Avant de publier" }).waitFor();
  await pageProf.screenshot({ path: "tests/tmp/reviser/06-publication.png", fullPage: true });
  const publier = pageProf.getByTestId("devoir-publication");
  if ((await publier.textContent()).includes("Publier")) await publier.click();
  await pageProf.getByTestId("devoir-etat").filter({ hasText: "Publié" }).waitFor();

  for (const largeur of [320, 390, 1280]) {
    const contexte = await navigateur.newContext({ viewport: { width: largeur, height: 900 }, reducedMotion: "reduce" });
    const page = await contexte.newPage();
    await connecter(page, base, acces.lina);
    await page.goto(`${base}/app`);
    await page.getByRole("link", { name: "Rechercher dans mes cours", exact: true }).waitFor();
    await page.screenshot({ path: `tests/tmp/reviser/01-accueil-${largeur}.png`, fullPage: true });
    await page.goto(`${base}/app/reviser`);
    const api = await page.request.get(`${base}/api/v6/reviser`);
    assert.equal(api.status(), 200);
    assert.ok((await api.json()).recommandations.some(r => r.devoir_id === acces.devoir));
    assert.ok(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth));
    await page.screenshot({ path: `tests/tmp/reviser/02-reviser-${largeur}.png`, fullPage: true });
    await page.getByRole("button", { name: "Commencer", exact: true }).click();
    await page.getByRole("radio", { name: "Le loyer mensuel" }).check();
    await page.screenshot({ path: `tests/tmp/reviser/03-exercice-${largeur}.png`, fullPage: true });
    await page.getByRole("button", { name: "Valider ma réponse" }).click();
    await page.getByText(/Le loyer reste fixe/).waitFor();
    await page.reload();
    await page.getByText(/Le loyer reste fixe/).waitFor();
    await page.screenshot({ path: `tests/tmp/reviser/04-correction-${largeur}.png`, fullPage: true });
    await page.getByRole("button", { name: "Exercice suivant" }).click();
    await page.getByRole("heading", { name: /atelier/ }).waitFor();
    await page.reload();
    await page.getByRole("heading", { name: /atelier/ }).waitFor();
    await page.getByLabel("Ta réponse", { exact: true }).fill("40");
    await page.getByRole("button", { name: "Valider ma réponse" }).click();
    await page.getByRole("button", { name: "Exercice suivant" }).click();
    await page.getByLabel("Ta réponse", { exact: true }).fill("La salle coûte toujours 200 €. Chaque repas ajoute 3 € : cette charge varie avec le nombre de repas.");
    await page.getByRole("button", { name: "Valider ma réponse" }).click();
    await page.getByRole("button", { name: /bilan/i }).click();
    await page.getByRole("heading", { name: "Entraînement terminé !" }).waitFor();
    await page.screenshot({ path: `tests/tmp/reviser/08-bilan-${largeur}.png`, fullPage: true });
    await contexte.close();
  }
  const temoin = await navigateur.newContext();
  const pageTemoin = await temoin.newPage();
  await connecter(pageTemoin, base, acces.temoin);
  const api = await pageTemoin.request.get(`${base}/api/v6/reviser`);
  assert.equal(api.status(), 200);
  assert.ok(!(await api.json()).recommandations.some(r => r.devoir_id === acces.devoir));
  const direct = await pageTemoin.request.get(`${base}/app/devoirs/${acces.devoir}`);
  assert.equal(direct.status(), 404);
  console.log("Réviser : publication, recommandation, reprise et isolation HTTP vérifiées.");
} finally {
  await navigateur.close();
}
