#!/usr/bin/env node
// =============================================================================
// Recette du site servi — AvecStudy
//
//   npm run build && npm run start
//   npm run verifier:site
//
// Ce script interroge le site réellement servi et contrôle ce qui se vérifie
// sans navigateur : codes de réponse, redirections, en-têtes de sécurité,
// structure des pages, et les règles de mise en page du cahier de finition qui
// se lisent dans le balisage — un seul H1, lien d'évitement en premier, aucun
// élément plus large que l'écran en dehors d'un conteneur à défilement.
//
// Ce qu'il ne remplace pas : un œil humain sur un vrai téléphone. Il repère les
// fautes structurelles, pas une hiérarchie visuelle ratée.
// =============================================================================

import { chargerEnv } from "./_commun.mjs";

// Les deux réglages peuvent venir de la ligne de commande ou de .env.local,
// comme le reste de la configuration : un secret se saisit dans un fichier,
// pas dans un historique de terminal.
chargerEnv();

const BASE = process.env.SITE_BASE ?? "http://localhost:3100";

/**
 * Déploiement Vercel protégé : les URL de Preview passent par l'authentification
 * Vercel et répondent 302 vers `vercel.com/sso-api`. Un script ne peut donc pas
 * les recetter tel quel.
 *
 * Vercel prévoit pour cela un contournement dédié à l'automatisation :
 * Project Settings → Deployment Protection → Protection Bypass for Automation,
 * qui donne un secret à présenter en en-tête. On le lit ici, jamais on ne
 * l'affiche.
 *
 *   # dans .env.local
 *   SITE_BASE=https://…vercel.app
 *   VERCEL_AUTOMATION_BYPASS_SECRET=…
 */
const BYPASS = process.env.VERCEL_AUTOMATION_BYPASS_SECRET ?? "";

// Seulement l'en-tête de contournement. `x-vercel-set-bypass-cookie` ferait
// répondre 307 vers la même adresse — le temps que Vercel pose son cookie —
// et toutes les vérifications de code de réponse verraient cette redirection
// au lieu de la page.
const ENTETES = BYPASS === "" ? {} : { "x-vercel-protection-bypass": BYPASS };

/** Toutes les requêtes du script passent par ici, pour porter l'en-tête. */
async function demander(chemin, options = {}) {
  return fetch(BASE + chemin, {
    ...options,
    headers: { ...ENTETES, ...(options.headers ?? {}) },
  });
}

const PUBLIQUES = [
  "/", "/produit", "/etablissements", "/securite", "/offre",
  "/aide", "/contact", "/accessibilite",
  "/mentions-legales", "/confidentialite", "/conditions",
];

// Pages ouvertes mais hors index : elles doivent repondre, sans etre referencees.
const OUVERTES_NON_INDEXEES = ["/connexion", "/mot-de-passe-oublie"];

const RESSOURCES = ["/robots.txt", "/sitemap.xml", "/manifest.webmanifest", "/icon", "/opengraph-image"];
const REDIRECTIONS = [["/fonctionnalites", "/produit"], ["/demo", "/etablissements"],
  ["/mes-cours", "/eleve"], ["/etablissement", "/admin"], ["/etablissement/import", "/admin/import"],
  ["/apres-connexion", "/app"]];
const PRIVEES = ["/administration", "/administration/etablissements", "/administration/journal",
  "/admin", "/admin/classes", "/admin/utilisateurs", "/admin/import",
  "/professeur", "/professeur/classes", "/professeur/devoirs",
  "/eleve", "/eleve/cours", "/eleve/devoirs",
  "/studio", "/parametres", "/app", "/activation"];

/**
 * Termes qui ne doivent apparaître sur aucune page publique.
 *
 * L'ancienne marque est cherchée avec une limite de mot à gauche : sans cela,
 * le domaine « avecstudy.fr » déclencherait une alerte à chaque page.
 */
const INTERDITS = [
  { libelle: "study. (ancienne marque)", motif: /(^|[^a-z])study\.(?![a-z_])/i },
  { libelle: "Study AI", motif: /study\s*ai\b/i },
  { libelle: "en construction", motif: /en construction/i },
  { libelle: "non opérationnel", motif: /non op[ée]rationnel/i },
  { libelle: "prototype", motif: /prototype/i },
  { libelle: "lorem ipsum", motif: /lorem ipsum/i },
  { libelle: "pas encore raccordé", motif: /pas encore raccord/i },
];

let echecs = 0;

function verifier(condition, texte, detail) {
  if (condition) {
    console.log(`  ok   ${texte}`);
    return true;
  }
  echecs += 1;
  console.log(`  NON  ${texte}${detail ? ` — ${detail}` : ""}`);
  return false;
}

async function principal() {
  console.log(`Recette du site servi sur ${BASE}`);
  if (BYPASS !== "") console.log("Protection de deploiement contournee par secret d automatisation.");
  console.log("");

  // Un déploiement protégé renvoie 302 vers l'authentification Vercel. Le dire
  // tout de suite évite une page de résultats entièrement rouge dont la seule
  // cause est qu'on n'a jamais atteint le site.
  const sonde = await demander("/", { redirect: "manual" });
  if (sonde.status === 302 && (sonde.headers.get("location") ?? "").includes("vercel.com/sso")) {
    console.log(
      "Ce deploiement est protege par l'authentification Vercel : le site n'est\n" +
        "pas joignable par un script.\n\n" +
        "  Project Settings > Deployment Protection > Protection Bypass for\n" +
        "  Automation, puis mettre le secret dans .env.local :\n\n" +
        "    SITE_BASE=" + BASE + "\n" +
        "    VERCEL_AUTOMATION_BYPASS_SECRET=...\n",
    );
    process.exit(2);
  }

  await verifierRoutes();
  await verifierStructure();
  await verifierMiseEnPage();
  await verifierSecurite();

  console.log("\n" + "-".repeat(72));
  if (echecs === 0) {
    console.log("Aucun defaut detecte.");
    process.exit(0);
  }
  console.log(`${echecs} defaut(s) a corriger.`);
  process.exit(1);
}

/* -------------------------------------------------------------------------- */

async function verifierRoutes() {
  console.log("Routes");

  for (const route of [...PUBLIQUES, ...RESSOURCES]) {
    const reponse = await demander(route, { redirect: "manual" });
    verifier(reponse.status === 200, `${route} repond 200`, `HTTP ${reponse.status}`);
  }

  // Ouvertes, mais jamais indexees : elles doivent repondre 200 et porter
  // l en-tete de non-indexation. Une page de connexion referencee par un
  // moteur, c est une page de connexion qu on attaque.
  for (const route of OUVERTES_NON_INDEXEES) {
    const reponse = await demander(route, { redirect: "manual" });
    verifier(reponse.status === 200, `${route} repond 200`, `HTTP ${reponse.status}`);
    const corps = await reponse.text();
    verifier(
      corps.includes("noindex"),
      `${route} demande a ne pas etre indexee`,
      "aucune directive noindex",
    );
  }

  for (const [ancienne, nouvelle] of REDIRECTIONS) {
    const reponse = await demander(ancienne, { redirect: "manual" });
    const cible = reponse.headers.get("location") ?? "";
    verifier(
      reponse.status === 308 && cible.endsWith(nouvelle),
      `${ancienne} redirige definitivement vers ${nouvelle}`,
      `HTTP ${reponse.status} vers ${cible || "(rien)"}`,
    );
  }

  for (const route of PRIVEES) {
    const reponse = await demander(route, { redirect: "manual" });
    const cible = reponse.headers.get("location") ?? "";
    verifier(
      reponse.status === 307 && cible.includes("/connexion"),
      `${route} renvoie vers la connexion quand on n est pas connecte`,
      `HTTP ${reponse.status} vers ${cible || "(rien)"}`,
    );
  }

  const introuvable = await demander("/cette-page-n-existe-pas", { redirect: "manual" });
  verifier(introuvable.status === 404, "une adresse inconnue repond 404", `HTTP ${introuvable.status}`);

  const corps404 = await introuvable.text();
  verifier(
    corps404.includes("Cette page n") && corps404.includes("Accueil"),
    "la page 404 propose une sortie",
  );
}

async function verifierStructure() {
  console.log("\nStructure des pages publiques");

  for (const route of PUBLIQUES) {
    const html = await (await demander(route)).text();
    const etiquette = route === "/" ? "/ (accueil)" : route;

    const titres = html.match(/<h1[^>]*>/g) ?? [];
    verifier(titres.length === 1, `${etiquette} : un seul titre de niveau 1`, `${titres.length} trouve(s)`);

    const titre = /<title>([^<]*)<\/title>/.exec(html)?.[1] ?? "";
    verifier(titre.includes("AvecStudy"), `${etiquette} : le titre porte la marque`, titre);
    verifier(
      !/AvecStudy.*AvecStudy/.test(titre),
      `${etiquette} : la marque n apparait qu une fois dans le titre`,
      titre,
    );

    verifier(
      /<link rel="canonical"/.test(html),
      `${etiquette} : adresse canonique declaree`,
    );

    verifier(
      html.indexOf("lien-evitement") > 0 &&
        html.indexOf("lien-evitement") < html.indexOf("<header"),
      `${etiquette} : le lien d evitement precede l en-tete`,
    );

    const presents = INTERDITS.filter((terme) => terme.motif.test(html)).map((t) => t.libelle);
    verifier(presents.length === 0, `${etiquette} : aucun terme de chantier`, presents.join(", "));

    const liensVides = (html.match(/href="#"/g) ?? []).length;
    verifier(liensVides === 0, `${etiquette} : aucun lien vide`, `${liensVides} trouve(s)`);
  }
}

async function verifierMiseEnPage() {
  console.log("\nMise en page (regles verifiables dans le balisage)");

  for (const route of PUBLIQUES) {
    const html = await (await demander(route)).text();
    const etiquette = route === "/" ? "/ (accueil)" : route;

    // Une largeur minimale superieure a l ecran d un telephone ne doit exister
    // que dans un conteneur a defilement horizontal.
    const largeurs = [...html.matchAll(/min-w-\[(\d+(?:\.\d+)?)(rem|px)\]/g)].map((m) => ({
      valeur: m[2] === "rem" ? Number(m[1]) * 16 : Number(m[1]),
      brut: m[0],
    }));

    const trop = largeurs.filter((l) => l.valeur > 360);
    const conteneurs = (html.match(/overflow-x-auto/g) ?? []).length;

    verifier(
      trop.length === 0 || conteneurs >= trop.length,
      `${etiquette} : chaque element large est dans un conteneur a defilement`,
      `${trop.length} large(s), ${conteneurs} conteneur(s)`,
    );

    // Les tableaux debordent vite : chacun doit etre dans un conteneur.
    const tableaux = (html.match(/<table/g) ?? []).length;
    verifier(
      tableaux === 0 || conteneurs >= tableaux,
      `${etiquette} : chaque tableau est dans un conteneur a defilement`,
      `${tableaux} tableau(x), ${conteneurs} conteneur(s)`,
    );

    // Les cibles tactiles : les boutons du systeme de design portent .bouton,
    // qui impose 44 px. On verifie qu aucun lien d action ne s en affranchit.
    const boutons = (html.match(/class="[^"]*\bbouton\b/g) ?? []).length;
    verifier(boutons > 0 || route.startsWith("/mentions"), `${etiquette} : boutons du systeme de design`, `${boutons}`);
  }

  // La feuille de style porte les valeurs imposees par le cahier.
  const css = await trouverFeuilleDeStyle();
  // La feuille est minifiée en production : aucun espace n'est garanti.
  const jeton = (nom, valeur) => new RegExp(`--${nom}:\\s*${valeur}`).test(css);

  // Valeurs du systeme de design V2 (ch. 03). Elles sont verifiees sur la page
  // servie, pas sur la feuille de style : ce qui compte est ce qui arrive au
  // navigateur d un lycee, apres compilation et minification.
  verifier(jeton("spacing-contenu", "1180px"), "conteneur de 1180 px");
  verifier(jeton("spacing-app", "1320px"), "cadre applicatif de 1320 px");
  verifier(jeton("spacing-cible", "44px"), "cible tactile de 44 px");
  verifier(jeton("text-h1", "4rem"), "H1 desktop a 64 px");
  verifier(jeton("text-h1-mobile", "2\.5rem"), "H1 mobile a 40 px");
  verifier(jeton("color-accent", "#9f315c"), "rose AvecStudy comme couleur d accent");
  verifier(css.includes("prefers-reduced-motion"), "mouvement reduit respecte");
  verifier(/overflow-x:\s*clip/.test(css), "aucun debordement horizontal");
}

async function verifierSecurite() {
  console.log("\nEn-tetes de securite");

  const reponse = await demander("/");
  const attendus = {
    "x-content-type-options": "nosniff",
    "x-frame-options": "DENY",
    "referrer-policy": "strict-origin-when-cross-origin",
    "cross-origin-opener-policy": "same-origin",
  };

  for (const [nom, valeur] of Object.entries(attendus)) {
    verifier(reponse.headers.get(nom) === valeur, `${nom} : ${valeur}`, reponse.headers.get(nom) ?? "absent");
  }

  const csp = reponse.headers.get("content-security-policy") ?? "";
  verifier(csp.includes("frame-ancestors 'none'"), "CSP : page non encadrable");
  verifier(csp.includes("object-src 'none'"), "CSP : aucun objet externe");
  verifier(/nonce-/.test(csp), "CSP : scripts a nonce");

  verifier(reponse.headers.get("x-powered-by") === null, "aucune signature de serveur");

  // robots.txt ne doit pas indexer l entree privee.
  const robots = await (await demander("/robots.txt")).text();
  verifier(robots.includes("/connexion"), "robots.txt ecarte l entree privee");

  // Le plan du site ne doit lister que des pages qui repondent 200.
  const sitemap = await (await demander("/sitemap.xml")).text();
  const adresses = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  verifier(adresses.length >= 10, `le plan du site liste ${adresses.length} pages`);

  for (const adresse of adresses) {
    const chemin = new URL(adresse).pathname;
    const reponsePage = await demander(chemin, { redirect: "manual" });
    verifier(reponsePage.status === 200, `plan du site : ${chemin} repond 200`, `HTTP ${reponsePage.status}`);
  }
}

async function trouverFeuilleDeStyle() {
  const html = await (await demander("/")).text();
  const lien = /<link rel="stylesheet" href="([^"]+)"/.exec(html)?.[1];
  if (lien === undefined) return "";
  return (await fetch(new URL(lien, BASE), { headers: ENTETES })).text();
}

principal().catch((erreur) => {
  console.error(`recette : ${erreur.message}`);
  process.exit(1);
});
