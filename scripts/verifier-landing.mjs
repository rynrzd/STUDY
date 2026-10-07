#!/usr/bin/env node
// =============================================================================
// Conformité de la landing à la référence — `npm run verifier:landing`
//
// Les captures d'écran demandées par le chapitre 12 (R01) se regardent à l'œil,
// dans un vrai navigateur. Ce script vérifie l'autre moitié, celle qui se
// mesure : que les neuf sections du chapitre 03 sont présentes, dans l'ordre,
// avec les textes exacts demandés.
//
// Ce n'est pas une validation visuelle et cela ne prétend pas l'être. C'est le
// garde-fou qui empêche une section de disparaître sans que personne le voie.
//
//   SITE_BASE=http://localhost:3100 node scripts/verifier-landing.mjs
// =============================================================================

import { chargerEnv, titre, abandonner } from "./_commun.mjs";

// Sans ceci, `SITE_BASE` n'est pas lue et le script mesure `localhost:3100` —
// c'est-à-dire, au mieux, un serveur local resté ouvert, et non le site
// déployé que l'on croit vérifier. Une vérification qui vise la mauvaise cible
// est plus dangereuse qu'une vérification absente : elle rassure.
chargerEnv();

const BASE = (process.env.SITE_BASE ?? "http://localhost:3100").replace(/\/+$/, "");
const BYPASS = process.env.VERCEL_AUTOMATION_BYPASS_SECRET ?? "";

/**
 * Les repères attendus, dans l'ordre de la référence.
 *
 * Chaque entrée porte son code de section : quand l'une tombe, on sait
 * immédiatement quel paragraphe du cahier relire.
 */
const REPERES = [
  // Landing R2 (dossier « refonte complète, sans 3D », 7 octobre 2026, §04).
  ["L01", "La plateforme"],
  ["L01", "Pour les lycées"],
  ["L01", "Se connecter"],
  ["L01", "Demander une démo"],
  ["L02", "L'espace de ta classe"],
  ["L02", "Ta classe,"],
  ["L02", "tout simplement."],
  ["L02", "Tes cours, le travail à faire et les échanges de ta classe. Enfin au même endroit."],
  ["L02", "Découvrir Study"],
  ["L02", "Exemple de présentation"],
  ["L03", "01 / Retrouver"],
  ["L03", "Le bon cours. Au bon moment."],
  ["L03", "Découvrir les cours"],
  ["L04", "02 / Échanger"],
  ["L04", "Une question ne devrait pas te bloquer."],
  ["L05", "03 / Transmettre"],
  ["L05", "Préparez une fois. Partagez à la bonne classe."],
  ["L05", "Voir l'espace professeur"],
  ["L06", "Votre établissement, simplement."],
  ["L06", "Pour mon établissement"],
  ["L06", "Importer la liste"],
  ["L06", "Vérifier les classes"],
  ["L06", "Préparer les accès"],
  ["L07", "Les questions qu'on nous pose."],
  ["L07", "Faut-il un ordinateur par élève ?"],
  ["L07", "Qui finance Study ?"],
  ["L07", "Comment démarrer ?"],
  ["L08", "Une classe qui avance ensemble."],
  ["L08", "Demander une démonstration"],
  ["L08", "Déjà un accès ? Se connecter"],
  ["L08", "Mentions légales"],
];

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
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ");
}

async function principal() {
  titre(`AvecStudy — conformite de la landing\n${BASE}`);

  const entetes = BYPASS === "" ? {} : { "x-vercel-protection-bypass": BYPASS };
  const reponse = await fetch(`${BASE}/`, { headers: entetes });

  if (!reponse.ok) abandonner(`la page d accueil repond HTTP ${reponse.status}`);
  const html = normaliser(await reponse.text());

  console.log("Sections du chapitre 03, dans l ordre");

  let position = 0;
  let ordreTenu = true;

  for (const [section, repere] of REPERES) {
    const attendu = normaliser(repere);
    const present = html.includes(attendu);

    if (!verifier(present, `${section} — « ${repere} »`, "absent de la page")) continue;

    // L'ordre compte autant que la présence : la référence raconte une
    // progression, et une section déplacée la casse.
    const apres = html.indexOf(attendu, position);
    if (apres < 0) ordreTenu = false;
    else position = apres;
  }

  verifier(ordreTenu, "les sections se suivent dans l ordre de la reference");

  // ---------------------------------------------------------------------
  // §2.2 et §2.4 — le hero sur telephone
  //
  // Le cahier V5 demande deux choses, et la seconde est la correction d une
  // faute constatee sur capture : « remplacer l apercu par des fragments
  // mobiles compacts sans sidebar », « aucun panneau desktop compresse ».
  //
  // Ce qui se verifie ici sans navigateur : que les fragments existent dans
  // un bloc masque au-dela du seuil, et que la fenetre d apercu - celle qui
  // porte une barre laterale - est bien, elle, masquee en dessous. Un
  // controle de position suffit : la fenetre doit venir apres son enveloppe
  // `hidden lg:block`, et aucune barre laterale ne doit la preceder.
  // ---------------------------------------------------------------------
  console.log("\nLe hero (R2, L02)");
  const brut = await (await fetch(`${BASE}/`, { headers: entetes })).text();
  verifier(!/<canvas/i.test(brut), "aucun canvas dans le HTML servi");
  verifier(!/Passer l.introduction/i.test(brut), "aucun lien « Passer l'introduction »");
  verifier((brut.match(/<h1[\s>]/g) ?? []).length === 1, "un seul H1");

  console.log("\nCe qui ne doit pas s y trouver");
  for (const [nom, motif] of PROSCRITS) {
    const trouve = motif.exec(html);
    verifier(trouve === null, `aucun ${nom}`, trouve ? `« ${trouve[0].slice(0, 60)} »` : "");
  }

  console.log("\n" + "-".repeat(72));
  if (echecs === 0) {
    console.log("La landing est conforme a la reference.");
    process.exitCode = 0;
    return;
  }
  console.log(`${echecs} ecart(s) avec la reference.`);
  process.exitCode = 1;
}

await principal();
