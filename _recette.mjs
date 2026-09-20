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
}

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
  await page.waitForTimeout(3500);
  const alertes = await page.evaluate(() =>
    [...document.querySelectorAll("[role=alert]")].map((e) => e.textContent.trim().slice(0, 160)),
  );
  if (alertes.length > 0) console.log("  message :", JSON.stringify(alertes));
  return page.url();
}

const CSV = [
  "Nom;Prénom;Classe;INE",
  "Dupont-Léger;Camille;2nde 4;R001",
  "O'Brien;Léa;2nde 4;R002",
  "Nguyên;Thi Anh;2nde 4;R003",
  ";;;",
  "Dupont-Léger;Camille;2nde 4;R001",
  "Martin;Noé;SECONDE 4;R004",
  "Swiatek;Zofia;2nde 4;R005",
].join("\r\n");

const cheminCsv = path.join(FICHIERS, "recette-2nde4.csv");
fs.writeFileSync(cheminCsv, "\uFEFF" + CSV, "utf8");

const apresConnexion = await connecter("LYCEE-RAOUL", "a.arrue", process.env.MDP_ADMIN ?? "");
noter(
  "A1 connexion administrateur",
  apresConnexion.endsWith("/admin") ? "ok" : "ECHEC",
  apresConnexion,
);
await capturer("01-admin-tableau-de-bord");

async function deposerEtAnalyser() {
  await page.goto(`${BASE}/admin/import`, { waitUntil: "networkidle" });
  await attendreHydratation();
  await page.locator('input[type="file"]').first().setInputFiles(cheminCsv);
  await page.waitForTimeout(1500);
  await page.locator("button", { hasText: /^Analyser/ }).first().click();
  await page.waitForLoadState("networkidle");
  await page.waitForTimeout(3500);
  return page.url();
}

const lot1 = await deposerEtAnalyser();
noter("A4 analyse", /\/admin\/import\/[0-9a-f-]{36}$/.test(lot1) ? "ok" : "ECHEC", lot1);
await capturer("03-admin-import-verification");

const apercu = await page.evaluate(() => ({
  chiffres: Object.fromEntries(
    [...document.querySelectorAll("dt")].map((dt) => [
      dt.textContent.trim(),
      dt.nextElementSibling?.textContent?.trim(),
    ]),
  ),
  classes: [...document.querySelectorAll("li")]
    .map((li) => li.textContent.trim())
    .filter((t) => /élève/.test(t)),
  doublons: [...document.querySelectorAll("p")]
    .map((p) => p.textContent.trim())
    .filter((t) => /double/.test(t))
    .slice(0, 1),
}));
console.log("APERCU", JSON.stringify(apercu, null, 2));

noter(
  "A5 une seule classe malgre deux orthographes",
  apercu.classes.length === 1 ? "ok" : "ECHEC",
  JSON.stringify(apercu.classes),
);
noter(
  "A6 le doublon exact est ecarte",
  apercu.chiffres["Élèves à créer"] === "5" ? "ok" : "ECHEC",
  `a creer = ${apercu.chiffres["Élèves à créer"]}`,
);

await page.locator("button", { hasText: /^Créer les/ }).first().click();
await page.waitForLoadState("networkidle");
await page.waitForTimeout(8000);
await capturer("04-admin-import-rapport");

const rapport = await page.evaluate(() => ({
  chiffres: Object.fromEntries(
    [...document.querySelectorAll("dt")].map((dt) => [
      dt.textContent.trim(),
      dt.nextElementSibling?.textContent?.trim(),
    ]),
  ),
  titres: [...document.querySelectorAll("h2")].map((e) => e.textContent.trim()),
}));
console.log("RAPPORT", JSON.stringify(rapport, null, 2));
noter(
  "A7 creation des comptes",
  rapport.chiffres["Comptes créés"] === "5" ? "ok" : "ECHEC",
  JSON.stringify(rapport.chiffres),
);

const acces = await page.evaluate(() =>
  [...document.querySelectorAll("dl")]
    .map((dl) => {
      const valeurs = [...dl.querySelectorAll("dd")].map((dd) => dd.textContent.trim());
      const nom = dl.parentElement?.querySelector("p")?.textContent?.trim() ?? "";
      return valeurs.length === 3
        ? { nom, code: valeurs[0], login: valeurs[1], mdp: valeurs[2] }
        : null;
    })
    .filter((x) => x !== null),
);
fs.writeFileSync(`${DOSSIER}/acces-recette.json`, JSON.stringify(acces, null, 2), "utf8");
noter("A8 fiches d acces rendues", acces.length === 5 ? "ok" : "ECHEC", `${acces.length} fiches`);

const lot2 = await deposerEtAnalyser();
noter("A9 second import ouvert", /\/admin\/import\/[0-9a-f-]{36}$/.test(lot2) ? "ok" : "ECHEC");

await page.locator("button", { hasText: /^Créer les/ }).first().click();
await page.waitForLoadState("networkidle");
await page.waitForTimeout(8000);
await capturer("05-admin-reimport-rapport");

const rapport2 = await page.evaluate(() =>
  Object.fromEntries(
    [...document.querySelectorAll("dt")].map((dt) => [
      dt.textContent.trim(),
      dt.nextElementSibling?.textContent?.trim(),
    ]),
  ),
);
console.log("REIMPORT", JSON.stringify(rapport2, null, 2));
noter(
  "A10 reimport sans doublon",
  rapport2["Comptes créés"] === "0" && rapport2["Déjà présents"] === "5" ? "ok" : "ECHEC",
  JSON.stringify(rapport2),
);

fs.writeFileSync(`${DOSSIER}/journal-recette.json`, JSON.stringify(journal, null, 2), "utf8");
console.log("\nerreurs de page :", erreurs.length === 0 ? "(aucune)" : erreurs);

await navigateur.close();
