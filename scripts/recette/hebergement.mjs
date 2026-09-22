#!/usr/bin/env node
// =============================================================================
// Où le calcul a lieu, et où la base se trouve.
//
//   npm run verifier:hebergement
//
// Pourquoi ce contrôle existe. L'audit du 23 septembre 2026 a relevé que la
// base vivait bien en Irlande — `aws-1-eu-west-1` — mais que **le rendu
// serveur s'exécutait à Washington**. Aucune région n'était déclarée nulle
// part : `vercel.json` n'en portait pas, le code non plus, et la plateforme
// avait donc appliqué son défaut. L'en-tête de réponse le disait pourtant à
// chaque requête, `X-Vercel-Id: cdg1::iad1::…` — encore fallait-il le lire.
//
// Conséquence concrète : le formulaire de connexion, les noms d'élèves, le
// contenu des copies traversaient l'Atlantique à chaque affichage, alors que
// la donnée au repos, elle, ne quittait pas l'Europe. Un lycée à qui l'on dit
// « la base est en Europe » n'entend pas « et le traitement, non ».
//
// ---------------------------------------------------------------------------
// Ce que ce contrôle prouve, et ce qu'il ne prouve pas
// ---------------------------------------------------------------------------
//
// Il prouve une chose, et elle est utile : **la région n'a pas rebasculé**. Un
// `vercel.json` modifié, une variable d'environnement, un défaut de plateforme
// qui change — et le calcul repart ailleurs sans que rien n'échoue. Ce contrôle
// le voit à la requête suivante.
//
// Il ne prouve **pas** la localisation juridique des données. Un code de région
// est un nom donné par un fournisseur, pas un engagement contractuel : une
// sauvegarde, un journal, un service d'assistance peuvent être ailleurs sans
// que cet en-tête change. Cette question-là se traite sur pièces, dans
// `docs/securite/`, et pas ici.
// =============================================================================

import { chargerEnv, titre } from "../_commun.mjs";

chargerEnv();

const BASE = (process.env.SITE_BASE ?? "http://localhost:3100").replace(/\/+$/, "");

/**
 * Les régions de calcul admises, et la raison de chacune.
 *
 * Uniquement l'Espace économique européen. Le Royaume-Uni (`lhr1`) n'y est
 * pas : il bénéficie d'une décision d'adéquation, ce qui est un autre régime
 * juridique — on ne l'ajoute pas sans l'avoir décidé explicitement.
 */
const REGIONS_CALCUL_ADMISES = new Map([
  ["cdg1", "Paris"],
  ["fra1", "Francfort"],
  ["arn1", "Stockholm"],
  ["dub1", "Dublin"],
]);

/** Les régions de base admises, à la même règle. */
const REGIONS_BASE_ADMISES = new Map([
  ["eu-west-1", "Irlande"],
  ["eu-west-3", "Paris"],
  ["eu-central-1", "Francfort"],
  ["eu-north-1", "Stockholm"],
  ["eu-south-1", "Milan"],
]);

/**
 * Des pages **rendues à la demande**.
 *
 * Une page prérendue sort du cache d'un point de présence et ne dit rien du
 * lieu de calcul : son `X-Vercel-Id` ne porte qu'un segment. Il faut donc des
 * pages qui déclenchent vraiment une fonction — celle qui lit le cookie de
 * session est la plus représentative, c'est elle qui voit la donnée.
 */
const PAGES_DYNAMIQUES = ["/connexion", "/eleve", "/professeur"];

let defauts = 0;

titre("AvecStudy — lieu de calcul et lieu de la base");

/* --- 1. Où le rendu serveur s'exécute ------------------------------------ */

console.log(`\nRendu serveur — ${BASE}`);

let mesurees = 0;

for (const page of PAGES_DYNAMIQUES) {
  let identifiant;
  try {
    const reponse = await fetch(`${BASE}${page}`, { method: "HEAD", redirect: "manual" });
    identifiant = reponse.headers.get("x-vercel-id");
  } catch (erreur) {
    console.log(`  --   ${page} — injoignable (${erreur.message})`);
    continue;
  }

  if (identifiant === null) {
    // Développement local, ou un autre hébergeur : il n'y a rien à mesurer, et
    // il vaut mieux le dire que de compter une absence comme une réussite.
    console.log(`  --   ${page} — aucun en-tete de region (hors Vercel)`);
    continue;
  }

  const segments = identifiant.split("::");
  if (segments.length < 3) {
    console.log(`  --   ${page} — servie depuis le cache (${segments[0]}), aucun calcul`);
    continue;
  }

  const region = segments[1];
  mesurees += 1;
  const ville = REGIONS_CALCUL_ADMISES.get(region);

  if (ville === undefined) {
    defauts += 1;
    console.log(`  NON  ${page} — calcul en « ${region} », hors des regions admises`);
  } else {
    console.log(`  ok   ${page} — calcul en « ${region} » (${ville})`);
  }
}

if (mesurees === 0) {
  console.log("  --   aucune page rendue a la demande n a pu etre mesuree");
}

/* --- 2. Où la base se trouve --------------------------------------------- */

console.log("\nBase de donnees");

const urlBase = (process.env.WORKER_DATABASE_URL ?? "").trim();

if (urlBase === "") {
  console.log("  --   WORKER_DATABASE_URL absente de cet environnement");
} else {
  let hote = "";
  try {
    hote = new URL(urlBase).hostname;
  } catch {
    defauts += 1;
    console.log("  NON  WORKER_DATABASE_URL illisible");
  }

  if (hote !== "") {
    // Le nom d'hôte du pooler porte la région : `aws-1-eu-west-1.pooler…`.
    const trouvee = [...REGIONS_BASE_ADMISES.keys()].find((region) => hote.includes(region));

    if (trouvee === undefined) {
      defauts += 1;
      // L'hôte n'est pas affiché : il identifie le projet.
      console.log("  NON  l hote de la base ne nomme aucune region admise");
    } else {
      console.log(`  ok   base en « ${trouvee} » (${REGIONS_BASE_ADMISES.get(trouvee)})`);
    }
  }
}

console.log("\n" + "-".repeat(72));
console.log(
  defauts === 0
    ? "Hebergement : calcul et base restent dans les regions declarees. La question\n" +
        "contractuelle, elle, se traite sur pieces — voir docs/securite/."
    : `Hebergement : ${defauts} ecart(s) avec les regions declarees.`,
);
process.exitCode = defauts === 0 ? 0 : 1;
