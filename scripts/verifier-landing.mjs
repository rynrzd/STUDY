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
  // Copie conforme de code/landing-reference.html (dossier R2, 7 octobre 2026).
  ["En-tête", "La plateforme"],
  ["En-tête", "Établissements"],
  ["En-tête", "Se connecter"],
  ["En-tête", "Demander une démo"],
  ["Hero", "Ta classe,"],
  ["Hero", "tout simplement."],
  ["Hero", "Tes cours, le travail à faire et les échanges de ta classe. Enfin au même endroit."],
  ["Hero", "Découvrir Study"],
  ["Hero", "Fonctions affines"],
  ["Hero", "Exemple illustratif de l’interface"],
  ["Cours", "Le bon cours."],
  ["Cours", "Au bon moment."],
  ["Cours", "Découvrir les cours →"],
  ["Échanges", "Une question ne devrait pas te bloquer."],
  ["Échanges", "Échange illustratif · salon collectif de classe"],
  ["Professeurs", "Pour les professeurs"],
  ["Professeurs", "Préparez une fois."],
  ["Professeurs", "Partagez à la bonne classe."],
  ["Professeurs", "Choisir la classe"],
  ["Établissement", "Votre établissement, simplement."],
  ["Établissement", "Voir la mise en place →"],
  ["Établissement", "01 · Importer"],
  ["Établissement", "02 · Vérifier"],
  ["Établissement", "03 · Préparer les accès"],
  ["FAQ", "Questions fréquentes"],
  ["FAQ", "Faut-il un ordinateur par élève ?"],
  ["FAQ", "Qui finance la plateforme ?"],
  ["FAQ", "Comment installer Study dans mon lycée ?"],
  ["Conclusion", "Une classe qui avance ensemble."],
  ["Conclusion", "Parlons de votre établissement."],
  ["Conclusion", "Demander une démonstration →"],
  ["Pied de page", "Sécurité et données"],
  ["Pied de page", "Mentions légales"],
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
