// Planches de comparaison : à gauche la vue de la maquette (recadrée), à
// droite la capture réelle (haut de page). Une planche par paire.
//   node comparer.mjs <dossier designs> <dossier captures> <dossier sortie>
import { chromium } from "playwright-core";
import { mkdirSync, readFileSync } from "node:fs";

const [designs, captures, sortie] = process.argv.slice(2);
mkdirSync(sortie, { recursive: true });
// [nom, maquette, x, y, largeur, hauteur, capture, hauteur affichée de la capture (px source)]
const PAIRES = [
  ["bienvenue", "02", 22, 15, 738, 316, "A01-1440", 900],
  ["hors-ligne", "02", 22, 347, 738, 333, "A21-1440", 900],
  ["aide", "02", 777, 347, 738, 333, "P12-1440", 1100],
  ["admin-vue", "04", 10, 95, 753, 460, "D01-1440", 1100],
  ["moderation", "04", 10, 570, 753, 440, "D04-1440", 900],
  ["recuperation", "04", 773, 570, 757, 440, "D03-1440", 1100],
  ["projets", "05", 22, 5, 738, 360, "A15-1440", 900],
  ["demande-adulte", "05", 777, 395, 738, 350, "A19-1440", 900],
  ["parametres", "05", 22, 758, 738, 262, "A20b-1440", 900],
  ["annees", "05", 777, 758, 738, 262, "D05-1440", 1100],
  ["mobile-classe", "03", 430, 560, 312, 460, "A12-390", 844],
  ["mobile-agenda", "03", 787, 560, 312, 460, "A16-390", 844],
  ["mobile-reviser", "03", 1140, 10, 312, 540, "A07-390", 844],
  ["mobile-accueil", "03", 430, 10, 312, 540, "A02-390", 844],
];
const b64 = (f) => `data:image/${f.endsWith(".png") ? "png" : "jpeg"};base64,${readFileSync(f).toString("base64")}`;
const nav = await chromium.launch({ channel: "msedge" });
const page = await nav.newPage({ viewport: { width: 1500, height: 800 } });
for (const [nom, m, x, y, w, h, cap, hc] of PAIRES) {
  const largeurCol = 720;
  const echelle = largeurCol / w;
  const mobile = w < 400;
  const colCap = mobile ? 360 : 720;
  const html = `<html><body style="margin:0;background:#fff;font:14px sans-serif">
  <div style="display:flex;gap:24px;padding:16px;align-items:flex-start">
   <figure style="margin:0"><figcaption style="margin-bottom:6px;font-weight:700">Maquette ${m} (recadrée)</figcaption>
    <div style="width:${largeurCol}px;height:${Math.round(h * echelle)}px;background:url(${b64(`${designs}/${m}-reference-utilisateur.png`)}) no-repeat;background-size:${Math.round(1536 * echelle)}px auto;background-position:-${Math.round(x * echelle)}px -${Math.round(y * echelle)}px;border:1px solid #ddd"></div></figure>
   <figure style="margin:0"><figcaption style="margin-bottom:6px;font-weight:700">Rendu réel ${cap} (données fictives)</figcaption>
    <div style="width:${colCap}px;height:${Math.round((hc * colCap) / (mobile ? 390 : 1440))}px;overflow:hidden;border:1px solid #ddd"><img src="${b64(`${captures}/${cap}.jpg`)}" style="width:${colCap}px;display:block"></div></figure>
  </div></body></html>`;
  await page.setContent(html);
  await page.screenshot({ path: `${sortie}/${nom}.jpg`, type: "jpeg", quality: 80, fullPage: true });
  console.log("ok", nom);
}
await nav.close();
