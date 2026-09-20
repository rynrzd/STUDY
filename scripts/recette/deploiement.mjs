#!/usr/bin/env node
// =============================================================================
// §13 — Quel code est réellement servi ?
//
//   npm run verifier:deploiement
//
// « J'ai poussé, donc c'est en ligne » est une phrase qui a déjà coûté cher
// dans ce projet : une vérification a tourné pendant des jours contre une
// préversion périmée, et déclarait la landing conforme sans jamais regarder la
// production.
//
// Ce script répond à trois questions, et à elles seules :
//
//   1. l'adresse annoncée répond-elle, et est-ce bien la bonne origine ?
//   2. quel identifiant de construction Next est servi ?
//   3. a-t-il changé depuis la dernière fois qu'on a regardé ?
//
// L'identifiant de construction n'est pas le SHA du commit — Vercel construit
// chez lui, et le SHA local ne s'y retrouve pas. C'est l'empreinte des noms de
// fichiers servis, que Next calcule d'après leur contenu : elle change dès que
// le code change, et reste identique tant qu'il ne change pas. La voir changer
// prouve qu'un nouveau code est servi ; la voir inchangée après une poussée
// prouve que le déploiement n'a pas eu lieu.
//
// Elle n'expose rien de plus que ce que reçoit déjà n'importe quel visiteur :
// ces noms de fichiers sont dans le HTML de la page d'accueil.
// =============================================================================

import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { chargerEnv, titre, RACINE } from "../_commun.mjs";

chargerEnv();

const BASE = (process.env.SITE_BASE ?? "").replace(/\/+$/, "");
if (BASE === "") {
  console.log("SITE_BASE absente : on ne sait pas quoi verifier.");
  process.exit(1);
}

const MEMOIRE = path.join(RACINE, ".deploiement-servi");
const ATTENDU = process.argv.includes("--attendre-changement");

titre(`AvecStudy — code servi\n${BASE}`);

/** Lit l'identifiant de construction dans le HTML servi. */
async function identifiantServi() {
  const reponse = await fetch(`${BASE}/`, { redirect: "follow" });
  if (!reponse.ok) return { erreur: `HTTP ${reponse.status}` };

  if (new URL(reponse.url).origin !== BASE) {
    return { erreur: `redirige vers ${new URL(reponse.url).origin}` };
  }

  const html = await reponse.text();

  // Next nomme ses fichiers d'après leur contenu. L'ensemble des noms servis
  // sur une page identifie donc la construction : il change dès que le code
  // change, et reste identique tant qu'il ne change pas.
  //
  // On en prend l'empreinte plutôt que d'en garder la liste : c'est plus court
  // à lire, et cela se compare d'un coup d'œil.
  const morceaux = [...html.matchAll(/\/_next\/static\/[^"']*?\/chunks\/([A-Za-z0-9_.-]+\.js)/g)]
    .map((trouve) => trouve[1])
    .sort();

  if (morceaux.length === 0) {
    return { erreur: "aucun fichier de construction dans la page" };
  }

  const empreinte = createHash("sha256")
    .update([...new Set(morceaux)].join("|"))
    .digest("hex")
    .slice(0, 16);

  return { identifiant: empreinte, morceaux: new Set(morceaux).size, octets: html.length };
}

let precedent = null;
try {
  precedent = readFileSync(MEMOIRE, "utf8").trim();
} catch {
  precedent = null;
}

const limite = Date.now() + (ATTENDU ? 8 * 60_000 : 0);
let resultat = await identifiantServi();

while (
  ATTENDU &&
  Date.now() < limite &&
  resultat.erreur === undefined &&
  precedent !== null &&
  resultat.identifiant === precedent
) {
  console.log("  … le code servi n a pas encore change, on attend.");
  await new Promise((resoudre) => setTimeout(resoudre, 20_000));
  resultat = await identifiantServi();
}

if (resultat.erreur !== undefined) {
  console.log(`\n  NON  le site ne repond pas comme attendu — ${resultat.erreur}`);
  process.exitCode = 1;
} else {
  console.log(`\n  ok   ${BASE} repond, ${Math.round(resultat.octets / 1024)} Ko de HTML`);
  console.log(
    `  ok   construction servie : ${resultat.identifiant} (${resultat.morceaux} fichiers)`,
  );

  if (precedent === null) {
    console.log("       (premiere mesure : rien a comparer)");
  } else if (precedent === resultat.identifiant) {
    console.log(`  ${ATTENDU ? "NON " : "note"} identique a la derniere mesure (${precedent})`);
    if (ATTENDU) {
      console.log("       Le deploiement n a pas eu lieu, ou n est pas termine.");
      process.exitCode = 1;
    }
  } else {
    console.log(`  ok   elle a change depuis la derniere mesure (${precedent})`);
  }

  writeFileSync(MEMOIRE, resultat.identifiant, "utf8");
}

console.log("\n" + "-".repeat(72));
console.log(
  process.exitCode === 1
    ? "Le code servi n est pas celui qu on attendait."
    : "Le code servi est identifie, et l origine est la bonne.",
);
