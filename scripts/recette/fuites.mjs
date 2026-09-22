#!/usr/bin/env node
// =============================================================================
// Ce que le navigateur reçoit vraiment : aucun secret, nulle part.
//
//   npm run verifier:fuites
//
// Pourquoi lire ce qui est **servi** plutôt que ce qui est écrit. Un secret ne
// fuite presque jamais par une ligne qu'on a écrite exprès. Il fuite parce
// qu'un composant serveur a passé un objet entier en accessoire à un composant
// client, et que Next a sérialisé cet objet dans la charge utile React qu'il
// inline dans le HTML. Rien n'échoue, rien ne s'affiche : la valeur est
// simplement là, dans la page, lisible par n'importe qui avec « afficher la
// source ».
//
// Ni la compilation, ni le typage, ni les tests d'unité ne voient ce chemin.
// Le seul contrôle qui le voit est celui qui télécharge la page et ses scripts
// et y cherche les valeurs qu'il connaît.
//
// ---------------------------------------------------------------------------
// Ce qu'il cherche
// ---------------------------------------------------------------------------
//
//   **Les valeurs réelles de l'environnement.** Les variables sensibles sont
//   lues dans l'environnement local et cherchées telles quelles. C'est le
//   contrôle fort : il ne dépend d'aucune forme, d'aucun préfixe, d'aucune
//   convention de nommage.
//
//   **Des formes connues**, pour le cas où la valeur servie viendrait d'un
//   autre environnement que celui d'où l'on regarde : un JWT, une clé
//   `sb_secret_`, une URL PostgreSQL portant un mot de passe.
//
// ---------------------------------------------------------------------------
// Ce qu'il n'affiche jamais
// ---------------------------------------------------------------------------
//
// Aucune valeur, même partielle, même trouvée. Un contrôle de fuite qui
// imprime ce qu'il a trouvé recopie la fuite dans les journaux de la recette,
// et les journaux voyagent plus loin que la page. Il dit le **nom** de la
// variable et le **fichier** où elle apparaît, ce qui suffit entièrement pour
// aller corriger.
// =============================================================================

import { chargerEnv, titre } from "../_commun.mjs";

chargerEnv();

const BASE = (process.env.SITE_BASE ?? "http://localhost:3100").replace(/\/+$/, "");

/**
 * Les pages parcourues.
 *
 * Uniquement des pages publiques : ce contrôle n'ouvre pas de session, et n'a
 * pas à en ouvrir. Un secret de serveur qui fuite fuite dans le squelette de
 * l'application, pas dans les données d'un élève — et les pages connectées
 * sont couvertes par les scénarios navigateur, qui, eux, sont authentifiés.
 */
const PAGES = ["/", "/connexion", "/offre", "/produit", "/mentions-legales", "/securite"];

/**
 * Les variables dont la valeur ne doit jamais atteindre un navigateur.
 *
 * `NEXT_PUBLIC_*` n'y figure pas, par définition : ces valeurs-là sont
 * publiques et leur présence est normale. C'est `src/lib/config.ts` qui vérifie
 * qu'aucune valeur privilégiée ne porte ce préfixe.
 */
const VARIABLES_INTERDITES = [
  "SUPABASE_SECRET_KEY",
  "SUPABASE_SERVICE_ROLE_KEY",
  "WORKER_DATABASE_URL",
  "SESSION_ENCRYPTION_KEY",
  "CRON_SECRET",
  "SUPABASE_DB_PASSWORD",
  "RESEND_API_KEY",
  "STRIPE_SECRET_KEY",
];

/**
 * Les formes reconnaissables, indépendamment de l'environnement d'où l'on
 * regarde.
 *
 * `eyJhbGciOi` est l'en-tête d'un JWT encodé en base64url : c'est la forme
 * d'une clé `service_role` Supabase historique. Une clé publique moderne
 * (`sb_publishable_`) n'a pas cette forme, donc aucun faux positif de ce côté.
 */
const FORMES = [
  { nom: "jeton JWT (clé service_role historique)", motif: /eyJhbGciOi[A-Za-z0-9_-]{10,}/ },
  { nom: "clé secrète Supabase", motif: /sb_secret_[A-Za-z0-9_-]{10,}/ },
  {
    nom: "URL PostgreSQL avec mot de passe",
    motif: /postgres(ql)?:\/\/[^\s"'<>]*:[^\s"'<>@]+@[^\s"'<>]+/,
  },
  { nom: "clé privée PEM", motif: /-----BEGIN (?:[A-Z ]+ )?PRIVATE KEY-----/ },
];

/** Les valeurs réellement présentes dans l'environnement, et donc cherchables. */
const valeursSurveillees = VARIABLES_INTERDITES.map((nom) => ({
  nom,
  valeur: (process.env[nom] ?? "").trim(),
}))
  // Une valeur trop courte donnerait des correspondances fortuites, et une
  // variable absente n'est pas cherchable : on dit lesquelles, pour que
  // personne ne prenne ce contrôle pour plus large qu'il n'est.
  .filter((v) => v.valeur.length >= 12);

let defauts = 0;
const absentes = VARIABLES_INTERDITES.filter(
  (nom) => !valeursSurveillees.some((v) => v.nom === nom),
);

titre("AvecStudy — aucun secret dans ce qui est servi");

console.log(`\nSource : ${BASE}`);
console.log(
  `${valeursSurveillees.length} variable(s) cherchee(s) par leur valeur reelle` +
    (absentes.length === 0
      ? "."
      : `, ${absentes.length} absente(s) de cet environnement donc non cherchable(s) :\n  ${absentes.join(", ")}`),
);

/** Inspecte un contenu servi. Ne renvoie jamais la valeur trouvée. */
function inspecter(etiquette, contenu) {
  let propre = true;

  for (const { nom, valeur } of valeursSurveillees) {
    if (contenu.includes(valeur)) {
      defauts += 1;
      propre = false;
      console.log(`  NON  ${etiquette} — la valeur de ${nom} y figure`);
    }
  }

  for (const { nom, motif } of FORMES) {
    if (motif.test(contenu)) {
      defauts += 1;
      propre = false;
      console.log(`  NON  ${etiquette} — ${nom}`);
    }
  }

  return propre;
}

/** Les scripts que la page charge, en adresses absolues. */
function scriptsDe(html, page) {
  const adresses = new Set();
  for (const correspondance of html.matchAll(/<script[^>]+src="([^"]+)"/g)) {
    const brute = correspondance[1];
    if (brute === undefined) continue;
    try {
      adresses.add(new URL(brute, `${BASE}${page}`).toString());
    } catch {
      // Adresse illisible : rien à télécharger.
    }
  }
  return adresses;
}

const scriptsVus = new Set();
let pagesLues = 0;
let scriptsLus = 0;

for (const page of PAGES) {
  let html;
  try {
    const reponse = await fetch(`${BASE}${page}`, { redirect: "follow" });
    if (!reponse.ok) {
      defauts += 1;
      console.log(`\n  NON  ${page} — la page ne repond pas (HTTP ${reponse.status})`);
      continue;
    }
    html = await reponse.text();
  } catch (erreur) {
    defauts += 1;
    console.log(`\n  NON  ${page} — ${erreur.message}`);
    continue;
  }

  pagesLues += 1;
  console.log(`\n${page}`);

  // Le HTML porte la charge utile React : c'est le chemin de fuite le plus
  // probable, et le moins visible.
  if (inspecter(`${page} (HTML et charge React)`, html)) {
    console.log("  ok   HTML et charge React");
  }

  for (const adresse of scriptsDe(html, page)) {
    if (scriptsVus.has(adresse)) continue;
    scriptsVus.add(adresse);

    // Les chunks sont partagés entre pages : on ne les relit qu'une fois, mais
    // on les lit tous, sans échantillonner.
    let code;
    try {
      const reponse = await fetch(adresse);
      if (!reponse.ok) {
        defauts += 1;
        console.log(`  NON  ${adresse} — HTTP ${reponse.status}`);
        continue;
      }
      code = await reponse.text();
    } catch (erreur) {
      defauts += 1;
      console.log(`  NON  ${adresse} — ${erreur.message}`);
      continue;
    }

    scriptsLus += 1;
    const court = adresse.slice(BASE.length) || adresse;
    inspecter(court, code);
  }
}

console.log(`\n${pagesLues} page(s) et ${scriptsLus} script(s) inspecte(s) integralement.`);
console.log("-".repeat(72));
console.log(
  defauts === 0
    ? "Fuites : aucun secret connu, aucune forme de secret dans ce qui est servi."
    : `Fuites : ${defauts} constat(s). Toute valeur trouvee est a considerer comme compromise.`,
);
process.exitCode = defauts === 0 ? 0 : 1;
