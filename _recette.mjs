// Jetable, non versionne. Recette connectee de bout en bout sur la production.
// Les mots de passe viennent de l environnement, jamais d un fichier.
import { chromium } from "playwright-core";
import fs from "node:fs";
import path from "node:path";

const BASE = process.env.SITE_BASE ?? "https://avecstudy.fr";
const DOSSIER =
  "C:/Users/RAYAN/AppData/Local/Temp/claude/c--Users-RAYAN-Documents-study-ai-v3-improved--1-/6b750d6a-24b7-49ef-801a-753226e8478f/scratchpad";
const CAPTURES = `${DOSSIER}/captures`;
const FICHIERS = `${DOSSIER}/fichiers`;

fs.mkdirSync(CAPTURES, { recursive: true });
fs.mkdirSync(FICHIERS, { recursive: true });

const journal = [];
function noter(etape, resultat, detail = "") {
  journal.push({ etape, resultat, detail });
  console.log(`${resultat === "ok" ? "ok   " : "ECHEC"} ${etape}${detail ? ` — ${detail}` : ""}`);
}

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

async function capturer(nom) {
  await page.screenshot({ path: `${CAPTURES}/${nom}.png`, fullPage: true });
  return `${nom}.png`;
}

/** Attend que React ait pris la main : cliquer avant ne teste rien de reel. */
async function attendreHydratation(selecteur = "body *") {
  await page.waitForFunction(
    (cible) => {
      for (const e of document.querySelectorAll(cible)) {
        if (Object.keys(e).some((k) => k.startsWith("__react"))) return true;
      }
      return false;
    },
    selecteur,
    { timeout: 20000 },
  );
}

async function connecter(code, identifiant, motDePasse) {
  await page.goto(`${BASE}/connexion`, { waitUntil: "networkidle" });
  await attendreHydratation("button[type=submit]");
  await page.locator('[name="code"]').fill(code);
  await page.locator('[name="identifiant"]').fill(identifiant);
  await page.locator('[name="motDePasse"]').fill(motDePasse);
  await page.locator('button[type="submit"]').first().click();
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(2500);
  return page.url();
}

/* ========================================================================== */
/* 1. Administrateur — connexion et tableau de bord                           */
/* ========================================================================== */

const apresConnexion = await connecter(
  "LYCEE-RAOUL",
  "a.arrue",
  process.env.MDP_ADMIN ?? "",
);

noter(
  "A1 connexion administrateur",
  apresConnexion.endsWith("/admin") ? "ok" : "ECHEC",
  apresConnexion,
);
await capturer("01-admin-tableau-de-bord");

const tableau = await page.evaluate(() => ({
  titre: document.querySelector("h1")?.textContent?.trim(),
  compteurs: [...document.querySelectorAll("dt")].map((dt) => ({
    terme: dt.textContent.trim(),
    valeur: dt.nextElementSibling?.textContent?.trim() ?? null,
  })),
}));
noter("A2 tableau de bord", "ok", JSON.stringify(tableau.compteurs));

/* ========================================================================== */
/* 2. Import d'une classe                                                     */
/* ========================================================================== */

// Un fichier de recette, sans aucune donnee personnelle reelle : des noms
// manifestement fictifs, avec accents, apostrophe, ligne vide, doublon, et une
// classe ecrite differemment de celle qui existera deja.
const CSV = [
  "Nom;Prénom;Classe;INE",
  "Dupont-Léger;Camille;2nde 4;R001",
  "O'Brien;Léa;2nde 4;R002",
  "Nguyên;Thi Anh;2nde 4;R003",
  ";;;",
  "Dupont-Léger;Camille;2nde 4;R001",
  "Martin;Noé;SECONDE 4;R004",
  "Świątek;Zofia;2nde 4;R005",
].join("\r\n");

const cheminCsv = path.join(FICHIERS, "recette-2nde4.csv");
fs.writeFileSync(cheminCsv, "\uFEFF" + CSV, "utf8");

await page.goto(`${BASE}/admin/import`, { waitUntil: "networkidle" });
await attendreHydratation();
await capturer("02-admin-import-depot");

const zone = await page.evaluate(() => ({
  champs: [...document.querySelectorAll('input[type="file"]')].map((e) => e.name),
  sections: [...document.querySelectorAll("h2")].map((e) => e.textContent.trim()),
}));
noter("A3 ecran d import", zone.champs.length >= 2 ? "ok" : "ECHEC", JSON.stringify(zone));

await page.locator('input[type="file"]').first().setInputFiles(cheminCsv);
await page.waitForTimeout(1200);

const apresDepot = await page.evaluate(() => ({
  fichiersListes: [...document.querySelectorAll("li")].map((li) => li.textContent.trim().slice(0, 50)).filter((t) => /Ko|csv/.test(t)),
  boutons: [...document.querySelectorAll("button")].map((b) => ({ t: b.textContent.trim().slice(0, 40), off: b.disabled })),
  alertes: [...document.querySelectorAll("[role=alert]")].map((e) => e.textContent.trim().slice(0, 120)),
}));
console.log("APRES DEPOT", JSON.stringify(apresDepot, null, 2));

const boutonAnalyser = page.locator("button", { hasText: /Analyser/ }).first();
await boutonAnalyser.click();
await page.waitForLoadState("networkidle");
await page.waitForTimeout(3000);

noter(
  "A4 analyse du fichier",
  /\/admin\/import\/[0-9a-f-]{36}$/.test(page.url()) ? "ok" : "ECHEC",
  page.url(),
);
await capturer("03-admin-import-verification");

const verification = await page.evaluate(() => ({
  chiffres: [...document.querySelectorAll("dt")].map(
    (dt) => `${dt.textContent.trim()} = ${dt.nextElementSibling?.textContent?.trim()}`,
  ),
  classes: [...document.querySelectorAll("li")]
    .map((li) => li.textContent.trim())
    .filter((t) => /élève/.test(t))
    .slice(0, 6),
  blocages: [...document.querySelectorAll('[role="alert"] li')].map((li) => li.textContent.trim()),
  boutonCreer: (() => {
    const b = [...document.querySelectorAll("button")].find((x) => /Créer les/.test(x.textContent));
    return b === undefined ? null : { texte: b.textContent.trim(), desactive: b.disabled };
  })(),
}));

console.log(JSON.stringify(verification, null, 2));
noter("A5 ecran de verification", verification.boutonCreer !== null ? "ok" : "ECHEC");

fs.writeFileSync(`${DOSSIER}/journal-recette.json`, JSON.stringify(journal, null, 2), "utf8");
console.log("\nerreurs de page :", erreurs.length === 0 ? "(aucune)" : erreurs);

await navigateur.close();
