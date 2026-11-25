#!/usr/bin/env node
// Vérifie les repères de l’accueil immersif dans le HTML rendu par le serveur.
// Les interactions sont couvertes par tests/navigateur/landing.test.mjs.

import { chargerEnv, titre, abandonner } from "./_commun.mjs";

// Sans ceci, `SITE_BASE` n'est pas lue et le script mesure `localhost:3100` —
// c'est-à-dire, au mieux, un serveur local resté ouvert, et non le site
// déployé que l'on croit vérifier. Une vérification qui vise la mauvaise cible
// est plus dangereuse qu'une vérification absente : elle rassure.
chargerEnv();

const BASE = (process.env.SITE_BASE ?? "http://localhost:3100").replace(/\/+$/, "");
const BYPASS = process.env.VERCEL_AUTOMATION_BYPASS_SECRET ?? "";

/** Ce qui ne doit apparaître nulle part sur la vitrine (ch. 02, L06). */
const PROSCRITS = [
  ["chiffre de clientèle", /\b\d{2,}\s*(lyc[ée]es?|[ée]tablissements?)\s+(nous|utilisent|font confiance)/i],
  ["témoignage inventé", /«[^»]{25,}»\s*[—–-]\s*[A-ZÀ-Ý][a-zà-ÿ]+\s+[A-ZÀ-Ý]/],
  ["jargon technique en vitrine", /\bRLS\b|row.level security|PostgREST/i],
  ["promesse de délai", /install[ée][^.]{0,30}en (moins de )?\d+ (jours?|heures?)/i],
];

let echecs = 0;

function verifier(condition, texte, detail = "") {
  if (condition) {
    console.log(`  ok   ${texte}`);
    return true;
  }
  echecs += 1;
  console.log(`  NON  ${texte}${detail ? ` — ${detail}` : ""}`);
  return false;
}

/** Rend les entités et les apostrophes typographiques comparables. */
function normaliser(html) {
  return html
    // React coupe le texte autour d'une expression — « Découvrir {MARQUE} »
    // devient « Découvrir <!-- -->AvecStudy ». Le texte est bien là ; le
    // marqueur d'hydratation n'a pas à faire échouer la comparaison.
    .replace(/<!--.*?-->/g, "")
    .replace(/&#x27;|&#39;|&apos;|’/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;|&#160;|<br\b[^>]*>/gi, " ")
    .replace(/\s+/g, " ");
}

async function principal() {
  titre(`AvecStudy — conformite de la landing\n${BASE}`);

  const entetes = BYPASS === "" ? {} : { "x-vercel-protection-bypass": BYPASS };
  const reponse = await fetch(`${BASE}/`, { headers: entetes });

  if (!reponse.ok) abandonner(`la page d accueil repond HTTP ${reponse.status}`);
  const html = normaliser(await reponse.text());

  verifier(/<h1[^>]*>Tu veux travailler quoi\s+aujourd'hui\s*\?<\/h1>/i.test(html),
    "la question d’accueil est visible au premier rendu");
  verifier((html.match(/<h1[\s>]/g) ?? []).length === 1, "un seul H1");
  verifier(/<input\b[^>]*\btype="search"/i.test(html), "la recherche est dans le HTML initial");
  verifier(/href="\/connexion"[^>]*>Se connecter<\/a>/i.test(html), "la connexion est accessible");
  verifier(!/<canvas/i.test(html), "aucun canvas dans le HTML servi");

  console.log("\nCe qui ne doit pas s y trouver");
  for (const [nom, motif] of PROSCRITS) {
    const trouve = motif.exec(html);
    verifier(trouve === null, `aucun ${nom}`, trouve ? `« ${trouve[0].slice(0, 60)} »` : "");
  }

  console.log("\n" + "-".repeat(72));
  if (echecs === 0) {
    console.log("Les repères de la landing immersive sont présents.");
    process.exitCode = 0;
    return;
  }
  console.log(`${echecs} écart(s) dans le HTML initial.`);
  process.exitCode = 1;
}

await principal();
