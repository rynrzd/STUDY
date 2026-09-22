#!/usr/bin/env node
// =============================================================================
// Les jetons de design appelés existent-ils ?
//
//   npm run verifier:jetons
//
// Une variable CSS qui n'existe pas ne casse rien : ni la compilation, ni le
// lint, ni les types. `color: var(--color-nexiste-pas)` est du CSS valide — la
// déclaration est simplement ignorée, et la propriété garde sa valeur héritée.
//
// Ce qui se casse, c'est l'écran. Deux exemples trouvés le même jour :
//
//   `--color-sur-accent`, appelé par une pastille de comptage, n'était défini
//   nulle part. Le texte héritait donc de l'encre presque noire, posée sur le
//   rose de l'accent : 2,8:1 là où WCAG 2.2 AA en demande 4,5. Le chiffre
//   était là, et se lisait mal.
//
//   `--color-fond-doux`, appelé par cinq blocs, n'existait pas non plus — le
//   jeton s'appelle `--color-surface-douce`. Les cinq fonds restaient blancs,
//   et personne ne l'avait remarqué parce qu'un fond blanc sur du blanc ne
//   proteste pas.
//
// Aucun outil du dépôt ne regardait cela. Celui-ci le fait, et il est rapide :
// il lit les fichiers, il n'ouvre pas de navigateur.
// =============================================================================

import { readFileSync } from "node:fs";
import { readdir } from "node:fs/promises";
import path from "node:path";
import { titre, RACINE } from "../_commun.mjs";

const FEUILLE = path.join(RACINE, "src", "styles", "globals.css");
const SOURCES = path.join(RACINE, "src");

/** Tous les fichiers d'un dossier, en descendant. */
async function fichiers(dossier) {
  const entrees = await readdir(dossier, { withFileTypes: true });
  const trouves = [];

  for (const entree of entrees) {
    const chemin = path.join(dossier, entree.name);
    if (entree.isDirectory()) trouves.push(...(await fichiers(chemin)));
    else if (/\.(tsx?|css)$/.test(entree.name)) trouves.push(chemin);
  }
  return trouves;
}

titre("AvecStudy — jetons de design appeles et definis");

/* --- Ce qui est défini ----------------------------------------------------- */

const feuille = readFileSync(FEUILLE, "utf8");

// Une définition, c'est `--nom:` en début de déclaration. Un appel, c'est
// `var(--nom)`. On ne confond pas les deux : `var(--a, var(--b))` appelle deux
// jetons et n'en définit aucun.
const definis = new Set(
  [...feuille.matchAll(/(^|[;{\s])(--[a-z0-9-]+)\s*:/gim)].map((trouve) => trouve[2]),
);

console.log(`\n${definis.size} jeton(s) defini(s) dans src/styles/globals.css.`);

/* --- Ce qui est appelé ----------------------------------------------------- */

const appels = new Map();

for (const chemin of await fichiers(SOURCES)) {
  const source = readFileSync(chemin, "utf8");

  // **Un jeton posé en ligne compte comme défini.** `style={{ "--delai": … }}`
  // en React est une définition parfaitement valide, faite au moment du rendu.
  // L'ignorer ferait crier le contrôle sur du code correct, et un contrôle qui
  // crie à tort finit par être ignoré.
  for (const trouve of source.matchAll(/["']( *--[a-z0-9-]+)["']\s*:/gi)) {
    definis.add(trouve[1].trim());
  }

  // **Un appel avec valeur de repli ne peut pas casser.** `var(--x, 0ms)`
  // rend `0ms` quand `--x` manque : c'est exactement la précaution qu'on
  // demanderait, et il n'y a rien à signaler.
  for (const trouve of source.matchAll(/var\(\s*(--[a-z0-9-]+)\s*(,?)/gi)) {
    if (trouve[2] === ",") continue;

    const nom = trouve[1];
    if (!appels.has(nom)) appels.set(nom, new Set());
    appels.get(nom).add(path.relative(RACINE, chemin));
  }
}

console.log(`${appels.size} jeton(s) appele(s) depuis src/.`);

/* --- L'écart --------------------------------------------------------------- */

const fantomes = [...appels.keys()].filter((nom) => !definis.has(nom)).sort();

console.log("");
if (fantomes.length === 0) {
  console.log("  ok   chaque jeton appele est defini");
} else {
  for (const nom of fantomes) {
    const ou = [...appels.get(nom)].slice(0, 4);
    console.log(`  NON  ${nom} est appele mais n existe pas`);
    for (const fichier of ou) console.log(`         ${fichier}`);
    if (appels.get(nom).size > 4) {
      console.log(`         (+${appels.get(nom).size - 4} autre(s) fichier(s))`);
    }
  }
}

/* --- Et l'inverse, pour information ---------------------------------------- */
//
// Un jeton défini que plus personne n'appelle n'est pas une faute : il peut
// servir à une feuille de style, ou attendre un écran à venir. On le signale
// sans le compter, pour que la palette ne se remplisse pas de couleurs mortes.

const jamaisAppeles = [...definis].filter(
  (nom) => nom.startsWith("--color-") && !appels.has(nom) && !feuille.includes(`var(${nom})`),
);

if (jamaisAppeles.length > 0) {
  console.log(`\n  note ${jamaisAppeles.length} couleur(s) definie(s) que rien n appelle :`);
  console.log(`         ${jamaisAppeles.join(", ")}`);
}

console.log("\n" + "-".repeat(72));
console.log(
  fantomes.length === 0
    ? "Jetons : aucune variable fantome."
    : `Jetons : ${fantomes.length} variable(s) appelee(s) sans exister.`,
);
process.exitCode = fantomes.length === 0 ? 0 : 1;
