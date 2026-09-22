#!/usr/bin/env node
// =============================================================================
// Les mentions légales, telles qu'elles sont **servies**.
//
//   npm run verifier:legal
//
// Pourquoi relire la page en ligne plutôt que le fichier source. Une
// immatriculation corrigée dans `identite-legale.ts` et jamais déployée reste
// fausse pour tout le monde sauf pour celui qui l'a corrigée. Les tests
// d'unité disent que la source est cohérente ; celui-ci dit que le public voit
// la même chose.
//
// Ce qu'il vérifie, et pourquoi chacun compte :
//
//   **SIREN et SIRET exacts.** Une immatriculation fausse sur une page de
//   mentions légales est une fausse déclaration, pas une coquille.
//
//   **Adresse exacte.** C'est l'adresse à laquelle une mise en demeure
//   s'envoie. Une rue erronée rend l'éditeur injoignable en droit.
//
//   **Mention de TVA exacte.** « TVA non applicable, article 293 B » dit
//   qu'aucune TVA ne sera facturée. L'omettre laisse un service comptable
//   supposer le contraire, et le devis ne correspond plus à la facture.
//
//   **Aucun « en cours de publication », aucun « à compléter ».** Ces phrases
//   étaient justes tant que les valeurs manquaient. Une fois publiées, elles
//   deviennent une erreur qui traîne — et elles traînent d'autant mieux que
//   personne ne relit une page légale.
//
//   **Les trois identités distinguées.** L'entreprise éditrice, le nom
//   commercial, l'hébergeur technique. Les confondre laisse croire qu'un nom
//   commercial est une société, ce qui change qui répond de quoi.
// =============================================================================

import { chargerEnv, titre } from "../_commun.mjs";
import { IDENTITE, mentionsManquantes } from "../../src/lib/identite-legale.ts";

chargerEnv();

const BASE = (process.env.SITE_BASE ?? "http://localhost:3100").replace(/\/+$/, "");

/** Les espaces d'un numéro ne sont qu'une commodité de lecture. */
const serre = (texte) => texte.replace(/\s+/g, " ").trim();

/**
 * Le texte de la page, sans balises et sans entités.
 *
 * On compare du texte lu, pas du HTML : une valeur coupée par une balise
 * — « 979 <span>992</span> 443 » — se lit bien et passerait pourtant à côté
 * d'une recherche brute dans la source.
 */
function texteDe(html) {
  return serre(
    html
      .replace(/<script[\s\S]*?<\/script>/gi, " ")
      .replace(/<style[\s\S]*?<\/style>/gi, " ")
      .replace(/<[^>]+>/g, " ")
      .replace(/&#x27;|&apos;/g, "'")
      .replace(/&quot;/g, '"')
      .replace(/&amp;/g, "&")
      .replace(/&lt;/g, "<")
      .replace(/&gt;/g, ">")
      .replace(/&nbsp;|&#160;/g, " ")
      .replace(/&eacute;/g, "é")
      .replace(/&egrave;/g, "è"),
  );
}

let defauts = 0;

function verifier(condition, texte, detail = "") {
  if (condition) {
    console.log(`  ok   ${texte}`);
    return true;
  }
  defauts += 1;
  console.log(`  NON  ${texte}${detail ? ` — ${detail}` : ""}`);
  return false;
}

titre("AvecStudy — mentions legales servies");
console.log(`cible : ${BASE}`);

/* --- 0. La source est-elle complète avant même d'être servie ? ------------ */

const manquantes = mentionsManquantes();
verifier(
  manquantes.length === 0,
  "la source ne laisse aucune mention obligatoire vide",
  manquantes.join(", "),
);

/* --- 1. La page de mentions légales --------------------------------------- */

console.log("\n/mentions-legales");

const reponse = await fetch(`${BASE}/mentions-legales`, { redirect: "follow" });

if (!reponse.ok) {
  defauts += 1;
  console.log(`  NON  la page ne repond pas (HTTP ${reponse.status})`);
} else {
  const texte = texteDe(await reponse.text());

  /* Les valeurs officielles, une par une. */
  const attendus = [
    ["SIREN", IDENTITE.siren],
    ["SIRET", IDENTITE.siret],
    ["adresse professionnelle", IDENTITE.adresse],
    ["mention de TVA", IDENTITE.regimeTva],
    ["code APE", IDENTITE.codeApe],
    ["adresse de contact", IDENTITE.contactEmail],
    ["telephone", IDENTITE.contactTelephone],
    ["directeur de la publication", IDENTITE.directeurPublication],
    ["raison sociale de l hebergeur", IDENTITE.hebergeur.raisonSociale],
    ["adresse de l hebergeur", IDENTITE.hebergeur.adresse],
  ];

  for (const [nom, valeur] of attendus) {
    if (valeur === null) continue;
    verifier(texte.includes(serre(valeur)), `${nom} : ${serre(valeur)}`, "absent de la page servie");
  }

  /* Ce qui ne doit plus s'y trouver. */
  console.log("");
  for (const interdit of [
    "En cours de publication",
    "en cours de publication",
    "À compléter",
    "A completer",
    "à compléter",
    "Mentions en cours",
  ]) {
    verifier(
      !texte.includes(interdit),
      `aucune mention « ${interdit} »`,
      "la page annonce encore une valeur comme manquante",
    );
  }

  /* Les trois identités, nommées et séparées. */
  console.log("");
  verifier(
    texte.includes("Entreprise éditrice") && texte.includes(IDENTITE.editeur),
    "l entreprise editrice est nommee",
  );
  verifier(
    texte.includes("Nom commercial") && texte.includes(IDENTITE.nomCommercial),
    "le nom commercial est distingue de l entreprise",
  );
  verifier(
    /nom commercial, et non une société/i.test(texte),
    "la page dit que le nom commercial n est pas une societe",
  );
  verifier(
    texte.includes("Hébergeur technique") && texte.includes(IDENTITE.hebergeur.nom),
    "l hebergeur est nomme comme prestataire technique distinct",
  );

  /* Un seul SIREN : deux numéros différents voudraient dire deux entreprises. */
  const sirens = [...texte.matchAll(/\b\d{3}\s?\d{3}\s?\d{3}\b/g)]
    .map((t) => t[0].replace(/\s/g, ""))
    .filter((n) => !texte.includes(`${n.slice(0, 9)}00`) || n.length === 9);

  const distincts = new Set(sirens.map((n) => n.slice(0, 9)));
  verifier(
    distincts.size <= 1,
    "un seul numero d entreprise figure sur la page",
    `${distincts.size} numeros distincts : ${[...distincts].join(", ")}`,
  );
}

/* --- 2. Les autres pages qui reprennent ces mentions ---------------------- */

for (const [chemin, attendus] of [
  ["/conditions", [IDENTITE.siret, IDENTITE.regimeTva, IDENTITE.editeur]],
  ["/confidentialite", [IDENTITE.siret, IDENTITE.contactEmail]],
  ["/contact", [IDENTITE.editeur, IDENTITE.contactEmail]],
]) {
  console.log(`\n${chemin}`);
  const page = await fetch(`${BASE}${chemin}`, { redirect: "follow" });

  if (!page.ok) {
    defauts += 1;
    console.log(`  NON  la page ne repond pas (HTTP ${page.status})`);
    continue;
  }

  const texte = texteDe(await page.text());

  for (const valeur of attendus) {
    if (valeur === null) continue;
    verifier(texte.includes(serre(valeur)), serre(valeur), "absent de la page servie");
  }

  verifier(
    !/en cours de publication|à compléter/i.test(texte),
    "aucune mention en attente",
  );
}

/* --- Le point de contact pour signaler une faille (RFC 9116) -------------- */

/**
 * Pourquoi ce contrôle est ici plutôt qu'ailleurs.
 *
 * `security.txt` est une mention publiée, au même titre que l'adresse de
 * l'éditeur : elle dit à qui écrire, elle doit correspondre à la source, et
 * elle se périme. L'audit du 23 septembre 2026 l'a trouvée absente — un
 * référent numérique qui voulait signaler quelque chose n'avait aucune porte
 * normalisée (constat F-10).
 *
 * L'échéance est la partie qui se retourne contre nous si personne ne la
 * regarde : un point de contact périmé est pire que pas de point de contact.
 * D'où l'avertissement soixante jours avant, qui laisse le temps d'agir.
 */
console.log("\n/.well-known/security.txt");

const JOURS_AVANT_ALERTE = 60;

try {
  const reponse = await fetch(`${BASE}/.well-known/security.txt`, { redirect: "follow" });

  if (!reponse.ok) {
    defauts += 1;
    console.log(`  NON  le fichier n est pas servi (HTTP ${reponse.status})`);
  } else {
    const texte = await reponse.text();

    verifier(
      IDENTITE.contactEmail === null || texte.includes(IDENTITE.contactEmail),
      "l adresse de contact est celle de l editeur",
      "elle differe de identite-legale.ts",
    );

    const echeance = /^Expires:\s*(\S+)/mi.exec(texte);
    if (echeance === null) {
      defauts += 1;
      // La RFC l'exige, et les outils qui lisent ce fichier ignorent un
      // fichier sans échéance plutôt que de lui faire confiance.
      console.log("  NON  aucune ligne « Expires », pourtant obligatoire");
    } else {
      const date = new Date(echeance[1]);
      const jours = Math.round((date.getTime() - Date.now()) / 86_400_000);

      if (Number.isNaN(date.getTime())) {
        defauts += 1;
        console.log("  NON  la date d echeance est illisible");
      } else if (jours <= 0) {
        defauts += 1;
        console.log(`  NON  le point de contact est perime depuis ${-jours} jour(s)`);
      } else if (jours <= JOURS_AVANT_ALERTE) {
        defauts += 1;
        console.log(`  NON  le point de contact expire dans ${jours} jour(s) — a repousser`);
      } else {
        console.log(`  ok   valable encore ${jours} jour(s)`);
      }
    }
  }
} catch (erreur) {
  defauts += 1;
  console.log(`  NON  le fichier n a pas pu etre lu — ${erreur.message}`);
}

console.log("\n" + "-".repeat(72));
console.log(
  defauts === 0
    ? "Mentions legales : ce qui est publie correspond a la source, et rien n est en attente."
    : `Mentions legales : ${defauts} ecart(s) entre la source et ce qui est servi.`,
);
process.exitCode = defauts === 0 ? 0 : 1;
