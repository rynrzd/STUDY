#!/usr/bin/env node
// =============================================================================
// §12 — Le contraste, mesuré et non supposé.
//
//   npm run verifier:contraste
//
// Jusqu'ici la recette vérifiait que les cibles tactiles étaient assez grandes
// et que le focus se voyait au clavier. Elle ne mesurait **aucune** couleur.
// « Conforme AA » se disait sans qu'un seul rapport de luminance ait été
// calculé — et un rapport, ça se calcule, ça ne s'estime pas à l'œil.
//
// Ce script ouvre les pages réellement servies et applique la sonde de
// `sonde-contraste.mjs` : chaque élément portant du texte, chaque frontière de
// composant, comparés aux seuils de WCAG 2.2 AA.
//
//   texte normal ............ 4,5:1
//   grand texte ............. 3:1   (≥ 24 px, ou ≥ 18,66 px en gras)
//   composants et focus ..... 3:1   (bordures de champs, contours de focus)
//
// Deux choses qu'il ne fait pas, et qu'il ne prétend pas faire :
//
//   **Il ne juge pas une image.** Un texte posé sur une photo se mesure à la
//   main ; aucune moyenne de pixels ne dit ce qu'un œil lit.
//
//   **Il ne remplace pas un lecteur d'écran.** Le contraste est une condition
//   nécessaire de la lisibilité, jamais une condition suffisante.
//
// Les écrans connectés sont mesurés ailleurs, par `CONTRASTE_01` : ils
// demandent un terrain, et le terrain n'existe que pendant une recette
// connectée.
// =============================================================================

import { chromium } from "playwright-core";
import { chargerEnv, titre } from "../_commun.mjs";
import { sondeContraste, sondeFocus } from "./sonde-contraste.mjs";

chargerEnv();

const BASE = (process.env.SITE_BASE ?? "http://localhost:3100").replace(/\/+$/, "");
const NAVIGATEUR = process.env.NAVIGATEUR_RECETTE ?? "msedge";

/** Les pages publiques : celles qu'un visiteur atteint sans compte. */
const PUBLIQUES = [
  "/",
  "/produit",
  "/etablissements",
  "/offre",
  "/securite",
  "/aide",
  "/contact",
  "/connexion",
  "/mentions-legales",
  "/confidentialite",
  "/conditions",
  "/accessibilite",
];

/**
 * Le plancher au-dessous duquel une page « sans échec » n'est pas rassurante.
 *
 * Une page réelle de ce produit offre des dizaines d'éléments texte. En voir
 * moins de quinze veut dire qu'on n'a pas mesuré la page mais son squelette —
 * et annoncer « conforme » là-dessus serait exactement le genre de
 * vérification qui rassure sans rien prouver. C'est ce garde-fou qui a révélé
 * qu'un serveur local périmé servait une coquille de 272 caractères là où la
 * page d'accueil en compte trois mille.
 */
const PLANCHER = 15;

let defauts = 0;
let pagesMesurees = 0;
let elementsMesures = 0;

function rendre(adresse, resultat) {
  pagesMesurees += 1;
  elementsMesures += resultat.mesures;

  if (resultat.mesures < PLANCHER) {
    defauts += 1;
    console.log(
      `  NON  ${adresse.padEnd(34)} seulement ${resultat.mesures} element(s) mesure(s) :` +
        " la page n a pas ete rendue en entier",
    );
    return;
  }

  if (resultat.fautes.length === 0) {
    console.log(`  ok   ${adresse.padEnd(34)} ${resultat.mesures} element(s) mesure(s)`);
    return;
  }

  defauts += resultat.fautes.length;
  console.log(`  NON  ${adresse.padEnd(34)} ${resultat.fautes.length} echec(s) :`);
  for (const faute of resultat.fautes.slice(0, 8)) {
    console.log(
      `         ${faute.mesure}:1 < ${faute.exige}:1  ${faute.genre}  ${faute.ou}` +
        `  ${faute.avant} sur ${faute.arriere}` +
        (faute.extrait ? `  « ${faute.extrait} »` : ""),
    );
  }
  if (resultat.fautes.length > 8) {
    console.log(`         (+${resultat.fautes.length - 8} autre(s))`);
  }
}

/* -------------------------------------------------------------------------- */

titre("AvecStudy — contraste WCAG 2.2 AA");
console.log(BASE === "" ? "cible : aucune" : `cible : ${BASE}`);

const navigateur = await chromium.launch({ channel: NAVIGATEUR, headless: true });

try {
  // `reducedMotion` : les blocs qui apparaissent au défilement restent sinon à
  // `opacity: 0`, et un élément transparent est exclu de la mesure — à juste
  // titre. Le composant `Reveler` respecte ce réglage et ne masque alors plus
  // rien : on mesure exactement ce que voit une personne qui a demandé moins
  // d'animations, c'est-à-dire la page entière.
  const contexte = await navigateur.newContext({
    viewport: { width: 1280, height: 900 },
    reducedMotion: "reduce",
  });
  const page = await contexte.newPage();

  try {
    console.log("\nPages publiques");

    for (const adresse of PUBLIQUES) {
      await page.goto(`${BASE}${adresse}`, { waitUntil: "networkidle" });
      rendre(adresse, await page.evaluate(sondeContraste));
    }

    // Le focus : on tabule une fois, et on mesure ce qui se voit.
    await page.goto(`${BASE}/connexion`, { waitUntil: "networkidle" });
    await page.keyboard.press("Tab");
    const focus = await page.evaluate(sondeFocus);

    if (focus === null) {
      defauts += 1;
      console.log("  NON  la tabulation n atteint aucun element focusable");
    } else if (!focus.visible) {
      defauts += 1;
      console.log("  NON  le focus ne se marque ni par un contour ni par une ombre");
    } else if (focus.mesure + 0.005 < 3) {
      defauts += 1;
      console.log(
        `  NON  contour de focus ${focus.mesure}:1 < 3:1 (${focus.couleur} sur ${focus.fond})`,
      );
    } else {
      console.log(`  ok   contour de focus ${focus.mesure}:1 sur ${focus.ou}`);
    }
  } finally {
    await contexte.close().catch(() => {});
  }
} finally {
  await navigateur.close().catch(() => {});
}

console.log("\nEcrans connectes");
console.log("  (mesures par CONTRASTE_01, qui dispose d un terrain jetable)");

console.log("\n" + "-".repeat(72));
console.log(
  defauts === 0
    ? `Contraste : ${elementsMesures} element(s) mesure(s) sur ${pagesMesurees} page(s), aucun echec AA.`
    : `Contraste : ${defauts} echec(s) WCAG 2.2 AA.`,
);
process.exitCode = defauts === 0 ? 0 : 1;
