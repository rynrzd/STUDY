// Captures R2 durables : écrans connectés (aperçus fictifs), pages publiques
// et écrans d'accès, à 1440 et 390 px. Vérifie au passage : débordement
// horizontal, erreurs de page, H1 unique, aucun canvas.
//   node captures-r2.mjs <base> <dossier>
import { chromium } from "playwright-core";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";

const [base = "http://localhost:3101", dossier] = process.argv.slice(2);
mkdirSync(dossier, { recursive: true });
const ECRANS = ["A01", "A03", "A08", "A04", "A04q", "A04p", "A05", "A06", "A09", "A10", "A11", "A13", "A14", "A12", "A15", "A16", "A17", "A18", "A19", "A19b", "A20", "A20b", "A20c", "A21", "A22", "T01", "T02", "T02b", "T03", "T04", "T05", "T05b", "T06", "T07", "T08", "T09", "T10", "D01", "D02", "D02b", "D02c", "D03", "D04", "D05", "D06", "D07", "D08", "D09", "D10", "D11", "D12", "D13", "D14"];
const AUTRES = [
  ["P01", "/"], ["P02", "/connexion"], ["P06", "/acces-oublie"], ["P09", "/rejoindre"], ["P10", "/session-expiree"], ["P11", "/lien-expire"],
  ["P12", "/aide"], ["P13", "/confidentialite"], ["P15", "/produit"], ["P16", "/etablissements"], ["P17", "/offre"], ["P18", "/contact"], ["P21", "/page-inexistante"],
  ["A02", "/apercu/accueil"], ["A07", "/apercu/cartes"], ["P05", "/activer"],
];
const tous = [...ECRANS.map((e) => [e, `/apercu/ecrans?ecran=${e}`]), ...AUTRES];
// SEULEMENT=A20c,D02b : ne recapturer que ces écrans (les résultats sont fusionnés).
const seulement = (process.env.SEULEMENT ?? "").split(",").filter(Boolean);
const cibles = seulement.length ? tous.filter(([id]) => seulement.includes(id)) : tous;
const nav = await chromium.launch({ channel: "msedge" });
const resultats = [];
for (const [l, h] of [[1440, 900], [390, 844]]) {
  const ctx = await nav.newContext({ viewport: { width: l, height: h }, isMobile: l < 768, hasTouch: l < 768, deviceScaleFactor: 1 });
  for (const [id, chemin] of cibles) {
    const page = await ctx.newPage();
    const erreurs = [];
    page.on("pageerror", (e) => erreurs.push(e.message));
    const r = await page.goto(base + chemin, { waitUntil: "networkidle", timeout: 180000 });
    await page.addStyleTag({ content: "nextjs-portal{display:none!important}" });
    const m = await page.evaluate(() => ({
      debordement: document.documentElement.scrollWidth - innerWidth,
      h1: document.querySelectorAll("h1").length,
      // Pas de canevas décoratif dans l'application ; celui du lecteur PDF
      // dessine le document lui-même et ne compte pas.
      canvas: [...document.querySelectorAll("canvas")].filter((c) => !c.closest(".lecteur-pdf")).length,
      hauteur: document.documentElement.scrollHeight,
    }));
    const ok = m.debordement <= 0 && erreurs.length === 0 && m.canvas === 0;
    resultats.push({ id, chemin, largeur: l, statut: r?.status() ?? 0, ...m, erreurs, ok });
    console.log(`${ok ? "ok " : "NON"} ${id} ${l}px statut ${r?.status()} débordement ${m.debordement} h1 ${m.h1} erreurs ${erreurs.length}`);
    await page.screenshot({ path: `${dossier}/${id}-${l}.jpg`, type: "jpeg", quality: 78, fullPage: true });
    await page.close();
  }
  await ctx.close();
}
await nav.close();
const fichier = `${dossier}/resultats.json`;
const anciens = seulement.length && existsSync(fichier) ? JSON.parse(readFileSync(fichier, "utf8")) : [];
const fusion = [...anciens.filter((a) => !resultats.some((r) => r.id === a.id && r.largeur === a.largeur)), ...resultats];
writeFileSync(fichier, JSON.stringify(fusion, null, 2));
console.log(`${resultats.filter((x) => x.ok).length}/${resultats.length}`);
