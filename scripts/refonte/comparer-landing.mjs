// Compare la landing servie à `code/landing-reference.html` du dossier R2 :
// mêmes largeurs, captures pleine page côte à côte, et écart de hauteur.
//   node scripts/refonte/comparer-landing.mjs <dossier code de référence> <base> <sortie>
import { chromium } from "playwright-core";
import { mkdirSync, readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const [code, base = "http://localhost:3101", sortie = "docs/refonte/comparaisons"] = process.argv.slice(2);
mkdirSync(sortie, { recursive: true });
const reference = pathToFileURL(path.join(code, "landing-reference.html")).href;
const nav = await chromium.launch({ channel: process.env.NAVIGATEUR_RECETTE ?? "msedge" });
for (const [l, h] of [[1440, 900], [390, 844]]) {
  const ctx = await nav.newContext({ viewport: { width: l, height: h }, deviceScaleFactor: 1 });
  const p = await ctx.newPage();
  await p.goto(reference);
  // La référence charge Manrope si elle est installée, sinon Arial : on lui
  // donne la même police que le site pour comparer la composition, pas la fonte.
  await p.addStyleTag({ content: "@import url('" + base + "/_next/static/media/manrope.woff2');" }).catch(() => {});
  const refImg = await p.screenshot({ fullPage: true, type: "jpeg", quality: 75 });
  const refH = await p.evaluate(() => document.documentElement.scrollHeight);
  await p.goto(`${base}/`, { waitUntil: "networkidle" });
  await p.addStyleTag({ content: "nextjs-portal{display:none!important}" });
  const reelImg = await p.screenshot({ fullPage: true, type: "jpeg", quality: 75 });
  const reelH = await p.evaluate(() => document.documentElement.scrollHeight);
  const deb = await p.evaluate(() => document.documentElement.scrollWidth - innerWidth);
  console.log(`${l}px : hauteur référence ${refH}, servie ${reelH} (écart ${reelH - refH}), débordement ${deb}`);
  const col = l > 800 ? 700 : 390;
  const page = await ctx.newPage();
  await page.setViewportSize({ width: col * 2 + 72, height: 800 });
  await page.setContent(`<body style="margin:0;font:14px sans-serif;background:#fff"><div style="display:flex;gap:24px;padding:16px;align-items:flex-start">
    <figure style="margin:0"><figcaption style="font-weight:700;margin-bottom:6px">Référence du cahier (landing-reference.html) — ${l}px</figcaption><img style="width:${col}px;border:1px solid #ddd" src="data:image/jpeg;base64,${refImg.toString("base64")}"></figure>
    <figure style="margin:0"><figcaption style="font-weight:700;margin-bottom:6px">Landing servie — ${l}px</figcaption><img style="width:${col}px;border:1px solid #ddd" src="data:image/jpeg;base64,${reelImg.toString("base64")}"></figure></div></body>`);
  await page.screenshot({ path: `${sortie}/landing-reference-${l}.jpg`, fullPage: true, type: "jpeg", quality: 80 });
  await ctx.close();
}
await nav.close();
void readFileSync;
