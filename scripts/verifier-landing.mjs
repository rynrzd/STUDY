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

import { titre, abandonner } from "./_commun.mjs";

const BASE = (process.env.SITE_BASE ?? "http://localhost:3100").replace(/\/+$/, "");
const BYPASS = process.env.VERCEL_AUTOMATION_BYPASS_SECRET ?? "";

/**
 * Les repères attendus, dans l'ordre de la référence.
 *
 * Chaque entrée porte son code de section : quand l'une tombe, on sait
 * immédiatement quel paragraphe du cahier relire.
 */
const REPERES = [
  ["L01", "La plateforme"],
  ["L01", "Pour les lycées"],
  ["L01", "Demander une démo"],
  ["L02", "La classe."],
  ["L02", "Tout simplement."],
  ["L02", "Le cours, les devoirs et l'entraide, au même endroit."],
  ["L02", "Découvrir AvecStudy"],
  ["L02", "Équiper mon lycée"],
  ["L02", "Des lycées plus unis"],
  ["L03", "En cours. À la maison. Toujours la même classe."],
  ["L03", "Sur ordinateur"],
  ["L03", "Sur papier"],
  ["L03", "À la maison"],
  ["L04", "Votre séance est prête."],
  ["L04", "Votre classe aussi."],
  ["L04", "Voir le côté professeur"],
  ["L06", "On avance mieux ensemble."],
  ["L07", "La rentrée commence avec votre liste de classe."],
  ["L08", "Faut-il un ordinateur par élève ?"],
  ["L08", "Qui finance la plateforme ?"],
  ["L08", "Comment installer AvecStudy dans mon lycée ?"],
  ["L09", "Et si on commençait par votre lycée ?"],
  ["L09", "Demander une démonstration"],
  ["L09", "Mentions légales"],
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
  console.log("\nLe hero sur telephone (V5 §2.2, §2.4)");

  const brut = await (await fetch(`${BASE}/`, { headers: entetes })).text();

  const fragments = /class="[^"]*lg:hidden[^"]*"/.test(brut);
  verifier(fragments, "des fragments propres au telephone existent", "aucun bloc lg:hidden");

  verifier(
    html.includes(normaliser("Aujourd'hui")) && html.includes(normaliser("À faire")),
    "les fragments nomment « Aujourd hui » et « A faire »",
  );

  // La barre laterale de la fenetre d apercu porte cette largeur fixe. Elle
  // ne doit apparaitre qu a l interieur de l enveloppe reservee au grand
  // ecran : si elle la precede, c est qu un panneau desktop est rendu sur
  // telephone.
  const enveloppe = brut.indexOf("hidden lg:-mb-24 lg:block");
  const laterale = brut.indexOf("w-[84px]");

  verifier(enveloppe >= 0, "la fenetre d apercu a une enveloppe reservee au grand ecran");
  verifier(
    laterale < 0 || (enveloppe >= 0 && laterale > enveloppe),
    "aucune barre laterale de bureau avant cette enveloppe",
    laterale < 0 ? "" : `barre laterale en position ${laterale}, enveloppe en ${enveloppe}`,
  );

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
