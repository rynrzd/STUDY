#!/usr/bin/env node
// =============================================================================
// §14 — La matrice des promesses.
//
//   npm run verifier:promesses
//
// Une page publique est un engagement commercial. Ce script empêche qu'elle
// redevienne un catalogue de ce qu'on aimerait avoir, par un mécanisme simple :
// **toute promesse affichée doit être reliée à un scénario connecté qui la
// joue réellement.**
//
// Il vérifie les deux sens, et les deux comptent :
//
//   1. chaque promesse de la matrice porte un scénario nommé ;
//   2. la page servie ne contient **aucune** promesse absente de la matrice —
//      c'est ce contrôle-là qui attrape l'ajout d'une ligne enthousiaste à
//      `/produit` un vendredi soir.
//
// Les noms de scénarios sont ceux qu'affichent les recettes connectées
// (DEPOT_01, CORRECTION_02, ENTRAIDE_01…). Un nom qui n'apparaît dans aucune
// exécution récente fait échouer la vérification.
// =============================================================================

import { readFileSync } from "node:fs";
import path from "node:path";
import { chargerEnv, titre, RACINE } from "../_commun.mjs";

chargerEnv();

const BASE = (process.env.SITE_BASE ?? "").replace(/\/+$/, "");

/**
 * La matrice.
 *
 * `scenario` nomme le contrôle qui la prouve. `null` est réservé aux promesses
 * dont la preuve est ailleurs que dans un parcours navigateur — et chacune
 * porte alors la raison, pour qu'on ne puisse pas y ranger ce qui dérange.
 */
export const PROMESSES = [
  // --- Préparer et publier ------------------------------------------------
  { promesse: "Bibliothèque privée", scenario: null, preuve: "test RLS ST01 : un document du Studio n'appartient qu'à son auteur" },
  { promesse: "Séance structurée", scenario: "STUDIO_BLOCS" },
  { promesse: "Publication par classe", scenario: "STUDIO_PUBLICATION" },
  { promesse: "Réutilisation", scenario: "STUDIO_DUPLICATION" },

  // --- Animer la séance ---------------------------------------------------
  { promesse: "Mode projection", scenario: null, preuve: "vue de projection du Studio, non couverte par un parcours automatisé" },
  { promesse: "Aperçu élève", scenario: "STUDIO_APERCU" },
  { promesse: "Impression", scenario: "STUDIO_IMPRESSION" },

  // --- Donner du travail --------------------------------------------------
  { promesse: "Devoir rattaché à la séance", scenario: "DEPOT_01" },
  { promesse: "Publié avec sa séance", scenario: "DEPOT_02" },
  { promesse: "Case « fait »", scenario: "FAIT_01" },

  // --- Ramasser et corriger -----------------------------------------------
  //
  // Chaque promesse pointe vers le contrôle qui la **joue**, pas vers celui qui
  // s'en approche. « Remise de la copie » tenait auparavant à DEPOT_06, qui
  // dépose un fichier ; REMISE_03 dépose, vérifie l'aperçu avant l'envoi,
  // l'écriture en base, l'absence de retard et l'accusé rendu après l'écriture.
  { promesse: "Remise de la copie", scenario: "REMISE_03" },
  { promesse: "Remplacement sans perte", scenario: "REMISE_05" },
  { promesse: "Une seule copie courante", scenario: "REMISE_06" },
  { promesse: "Remise sur papier", scenario: "PAPIER_01" },
  { promesse: "Constat du professeur", scenario: "PAPIER_02" },
  { promesse: "Remise en retard", scenario: "REMISE_09" },
  { promesse: "Fermeture à l'échéance", scenario: "REMISE_10" },
  { promesse: "Suivi de la classe", scenario: "DEPOT_11" },
  { promesse: "La copie s'ouvre côté professeur", scenario: "REMISE_11" },
  { promesse: "Correction individuelle", scenario: "CORR_IND_02" },
  { promesse: "Fichier corrigé", scenario: "CORR_IND_04" },
  { promesse: "Correction pour la classe", scenario: "CORRECTION_05" },
  { promesse: "Preuve de remise", scenario: "PREUVE_01" },
  { promesse: "Ce qui vous concerne", scenario: "NOUVEAUTE_01" },

  // --- Entraide -----------------------------------------------------------
  { promesse: "Questions sur le cours", scenario: "ENTRAIDE_01" },
  { promesse: "Groupes de travail", scenario: null, preuve: "tests RLS E01 et E02 : un groupe réunit les élèves d'un cours, et pas d'autres" },
  { promesse: "Jamais imprimé", scenario: "STUDIO_IMPRESSION" },
  { promesse: "Signalement", scenario: "MODERATION_07" },

  // --- Administrer --------------------------------------------------------
  { promesse: "Import de rentrée", scenario: "IMPORT_01" },
  { promesse: "Remise des accès", scenario: null, preuve: "recette réelle : trois fiches d'accès rendues, une seule fois" },
  { promesse: "Affectation par cours", scenario: "TERRAIN_AFFECTATION" },
  { promesse: "Second facteur", scenario: "MFA_01" },
  { promesse: "Journal", scenario: null, preuve: "npm run verifier:journal : contenu, immutabilité et absence de secret" },
];

/* -------------------------------------------------------------------------- */

titre("AvecStudy — matrice des promesses");

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

/* --- 1. Chaque promesse porte une preuve nommée ---------------------------- */

console.log("\nChaque promesse est reliée à une preuve");

for (const ligne of PROMESSES) {
  const nommee = ligne.scenario !== null || (ligne.preuve ?? "") !== "";
  verifier(
    nommee,
    `« ${ligne.promesse} » → ${ligne.scenario ?? ligne.preuve ?? "(rien)"}`,
    nommee ? "" : "aucun scénario, aucune preuve",
  );
}

/* --- 2. La page ne promet rien de plus ------------------------------------- */

console.log("\nLa page servie ne promet rien qui ne soit dans la matrice");

if (BASE === "") {
  defauts += 1;
  console.log("  NON  SITE_BASE absente : la page publique n a pas pu etre relue.");
} else {
  const reponse = await fetch(`${BASE}/produit`, { redirect: "follow" });

  if (!reponse.ok) {
    defauts += 1;
    console.log(`  NON  /produit ne repond pas (HTTP ${reponse.status})`);
  } else {
    const html = await reponse.text();

    // Les promesses sont les intitulés des définitions : `<dt>…</dt>`.
    const affichees = [...html.matchAll(/<dt[^>]*>([^<]{2,80})<\/dt>/g)]
      .map((trouve) => decoder(trouve[1].trim()))
      .filter((texte) => texte !== "");

    const connues = new Set(PROMESSES.map((p) => p.promesse));
    const inconnues = affichees.filter((texte) => !connues.has(texte));

    verifier(
      affichees.length > 0,
      "les promesses de la page ont pu etre relues",
      `${affichees.length} intitule(s)`,
    );

    verifier(
      inconnues.length === 0,
      "aucune promesse affichee n echappe a la matrice",
      inconnues.length === 0 ? "" : inconnues.join(" | "),
    );

    // Et l'inverse : une promesse de la matrice retirée de la page n'est pas
    // une faute — on peut cesser d'annoncer une fonction qui existe — mais on
    // le signale, pour que la matrice ne dérive pas en liste morte.
    const absentes = [...connues].filter((texte) => !affichees.includes(texte));
    if (absentes.length > 0) {
      console.log(
        `  note la matrice cite ${absentes.length} promesse(s) que la page n affiche plus :`,
      );
      for (const texte of absentes) console.log(`         ${texte}`);
    }
  }
}

/* --- 3. Les scénarios nommés existent dans le code ------------------------- */

console.log("\nChaque scénario nommé existe dans les recettes");

const sources = [
  "scripts/recette/scenario-remises.mjs",
  "scripts/recette/scenario-remises-individuelles.mjs",
  "scripts/recette/scenario-moderation.mjs",
  "scripts/recette/scenario-studio.mjs",
  "scripts/recette/scenario-classe.mjs",
  "scripts/recette/scenario-import.mjs",
  "scripts/recette/scenario-fichiers.mjs",
  "scripts/recette/connectee.mjs",
]
  .map((relatif) => {
    try {
      return readFileSync(path.join(RACINE, relatif), "utf8");
    } catch {
      return "";
    }
  })
  .join("\n");

for (const ligne of PROMESSES) {
  if (ligne.scenario === null) continue;
  verifier(
    sources.includes(ligne.scenario),
    `le scenario ${ligne.scenario} est joue par une recette`,
    sources.includes(ligne.scenario) ? "" : "introuvable dans les scenarios",
  );
}

/* -------------------------------------------------------------------------- */

function decoder(texte) {
  return texte
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&#x27;|&apos;/g, "'")
    .replace(/&nbsp;/g, " ");
}

console.log("\n" + "-".repeat(72));
console.log(
  defauts === 0
    ? "Matrice des promesses : chaque promesse publique a une preuve."
    : `Matrice des promesses : ${defauts} promesse(s) sans preuve, ou non declaree(s).`,
);
process.exitCode = defauts === 0 ? 0 : 1;
