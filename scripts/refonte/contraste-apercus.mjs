#!/usr/bin/env node
// =============================================================================
// Contraste WCAG 2.2 AA des écrans connectés recomposés (R2), mesuré sur leurs
// aperçus de développement (/apercu/ecrans, données fictives).
//
//   SITE_BASE=http://localhost:3101 node scripts/refonte/contraste-apercus.mjs
//
// Même sonde que la recette (`scripts/recette/sonde-contraste.mjs`). Ne
// remplace pas CONTRASTE_01, qui mesure les vrais écrans d'un terrain de
// recette : ici, ce sont les mêmes vues, avec d'autres données.
// =============================================================================

import { chromium } from "playwright-core";
import { sondeContraste } from "../recette/sonde-contraste.mjs";

const BASE = (process.env.SITE_BASE ?? "http://localhost:3101").replace(/\/+$/, "");
const ECRANS = [
  "A01", "A03", "A04", "A06", "A08", "A09", "A10", "A11", "A12", "A13", "A14", "A15", "A16", "A17", "A18", "A19", "A19b",
  "A20", "A20b", "A20c", "A21", "T01", "T02", "T02b", "T03", "T04", "T05", "T05b", "D01", "D02", "D02b", "D03", "D04", "D05",
];

const navigateur = await chromium.launch({ channel: process.env.NAVIGATEUR_RECETTE ?? "msedge", headless: true });
let defauts = 0;
let elements = 0;
try {
  const contexte = await navigateur.newContext({ viewport: { width: 1280, height: 900 }, reducedMotion: "reduce" });
  const page = await contexte.newPage();
  for (const id of ECRANS) {
    await page.goto(`${BASE}/apercu/ecrans?ecran=${id}`, { waitUntil: "networkidle", timeout: 180000 });
    await page.addStyleTag({ content: "nextjs-portal{display:none!important}" });
    const r = await page.evaluate(sondeContraste);
    elements += r.mesures;
    if (r.mesures < 15) {
      defauts += 1;
      console.log(`  NON  ${id} : seulement ${r.mesures} élément(s) mesuré(s)`);
    } else if (r.fautes.length === 0) {
      console.log(`  ok   ${id.padEnd(5)} ${r.mesures} élément(s)`);
    } else {
      defauts += r.fautes.length;
      console.log(`  NON  ${id} : ${r.fautes.length} échec(s)`);
      for (const f of r.fautes.slice(0, 6)) console.log(`         ${f.mesure}:1 < ${f.exige}:1  ${f.genre}  ${f.ou}  ${f.avant} sur ${f.arriere}${f.extrait ? `  « ${f.extrait} »` : ""}`);
    }
  }
} finally {
  await navigateur.close();
}
console.log(`\n${ECRANS.length} écrans, ${elements} éléments mesurés, ${defauts} défaut(s).`);
process.exit(defauts === 0 ? 0 : 1);
