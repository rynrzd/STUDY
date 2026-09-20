// Jetable, non versionne. Recette connectee sur la production.
// Le mot de passe vient de l environnement, jamais d un fichier.
import { chromium } from "playwright-core";
import fs from "node:fs";

const BASE = process.env.SITE_BASE ?? "https://avecstudy.fr";
const CAPTURES =
  "C:/Users/RAYAN/AppData/Local/Temp/claude/c--Users-RAYAN-Documents-study-ai-v3-improved--1-/6b750d6a-24b7-49ef-801a-753226e8478f/scratchpad/captures";

fs.mkdirSync(CAPTURES, { recursive: true });

const navigateur = await chromium.launch({
  channel: process.env.NAVIGATEUR_RECETTE ?? "msedge",
});
const contexte = await navigateur.newContext({ viewport: { width: 1366, height: 900 } });
const page = await contexte.newPage();

const erreurs = [];
page.on("pageerror", (e) => erreurs.push(String(e).slice(0, 200)));
page.on("console", (m) => {
  if (m.type() === "error") erreurs.push(`[console] ${m.text().slice(0, 200)}`);
});

page.on("request", (r) => { if (r.method() === "POST") console.log("POST ->", r.url()); });
page.on("response", async (r) => {
  if (r.request().method() === "POST") {
    console.log("POST <-", r.status(), r.url());
  }
});

await page.goto(`${BASE}/connexion`, { waitUntil: "networkidle" });

// L hydratation doit avoir eu lieu avant de cliquer, sinon on mesure un envoi
// natif et non le chemin reel de l application.
await page.waitForFunction(() => {
  const b = document.querySelector("button[type=submit]");
  return b !== null && Object.keys(b).some((k) => k.startsWith("__react"));
}, null, { timeout: 15000 });
console.log("hydrate : oui");
await page.locator('[name="code"]').fill("LYCEE-RAOUL");
await page.locator('[name="identifiant"]').fill("a.arrue");
await page.locator('[name="motDePasse"]').fill(process.env.MDP_ADMIN ?? "");
await page.locator('button[type="submit"]').first().click();
await page.waitForLoadState("networkidle");
await page.waitForTimeout(4000);

console.log("URL apres connexion :", page.url());

const etat = await page.evaluate(() => ({
  chemin: location.pathname,
  titre: document.querySelector("h1")?.textContent?.trim() ?? null,
  sousTitre: document.querySelector("h1 + p, h1 ~ p")?.textContent?.trim().slice(0, 90) ?? null,
  h2: [...document.querySelectorAll("h2")].map((e) => e.textContent.trim().slice(0, 50)),
  alertes: [...document.querySelectorAll('[role="alert"]')].map((e) =>
    e.textContent.trim().slice(0, 140),
  ),
  liensNav: [...document.querySelectorAll("nav a")].map((e) => e.textContent.trim()).slice(0, 12),
}));

console.log(JSON.stringify(etat, null, 2));
console.log("erreurs page :", erreurs.length === 0 ? "(aucune)" : erreurs);

await page.screenshot({ path: `${CAPTURES}/01-admin-tableau-de-bord.png`, fullPage: true });
console.log("capture :", `${CAPTURES}/01-admin-tableau-de-bord.png`);

await navigateur.close();
