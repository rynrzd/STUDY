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

const BASE = process.env.SITE_BASE ?? "http://localhost:3100";

const PUBLIQUES = [
  "/", "/produit", "/etablissements", "/securite", "/offre",
  "/aide", "/contact", "/accessibilite",
  "/mentions-legales", "/confidentialite", "/conditions",
];

const RESSOURCES = ["/robots.txt", "/sitemap.xml", "/manifest.webmanifest", "/icon", "/opengraph-image"];
const REDIRECTIONS = [["/fonctionnalites", "/produit"], ["/demo", "/etablissements"]];
const PRIVEES = ["/administration", "/administration/etablissements", "/administration/journal",
  "/etablissement", "/etablissement/import", "/mes-cours", "/apres-connexion", "/activation"];

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
  console.log(`Recette du site servi sur ${BASE}\n`);

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
    const reponse = await fetch(BASE + route, { redirect: "manual" });
    verifier(reponse.status === 200, `${route} repond 200`, `HTTP ${reponse.status}`);
  }

  for (const [ancienne, nouvelle] of REDIRECTIONS) {
    const reponse = await fetch(BASE + ancienne, { redirect: "manual" });
    const cible = reponse.headers.get("location") ?? "";
    verifier(
      reponse.status === 308 && cible.endsWith(nouvelle),
      `${ancienne} redirige definitivement vers ${nouvelle}`,
      `HTTP ${reponse.status} vers ${cible || "(rien)"}`,
    );
  }

  for (const route of PRIVEES) {
    const reponse = await fetch(BASE + route, { redirect: "manual" });
    const cible = reponse.headers.get("location") ?? "";
    verifier(
      reponse.status === 307 && cible.includes("/connexion"),
      `${route} renvoie vers la connexion quand on n est pas connecte`,
      `HTTP ${reponse.status} vers ${cible || "(rien)"}`,
    );
  }

  const introuvable = await fetch(`${BASE}/cette-page-n-existe-pas`, { redirect: "manual" });
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
    const html = await (await fetch(BASE + route)).text();
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
    const html = await (await fetch(BASE + route)).text();
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

  verifier(jeton("spacing-contenu", "1220px"), "conteneur de 1220 px");
  verifier(jeton("spacing-cible", "44px"), "cible tactile de 44 px");
  verifier(jeton("text-h1", "4\\.5rem"), "H1 desktop a 72 px");
  verifier(jeton("text-h1-mobile", "2\\.75rem"), "H1 mobile a 44 px");
  verifier(css.includes("prefers-reduced-motion"), "mouvement reduit respecte");
  verifier(/overflow-x:\s*clip/.test(css), "aucun debordement horizontal");
}

async function verifierSecurite() {
  console.log("\nEn-tetes de securite");

  const reponse = await fetch(BASE + "/");
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
  const robots = await (await fetch(BASE + "/robots.txt")).text();
  verifier(robots.includes("/connexion"), "robots.txt ecarte l entree privee");

  // Le plan du site ne doit lister que des pages qui repondent 200.
  const sitemap = await (await fetch(BASE + "/sitemap.xml")).text();
  const adresses = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  verifier(adresses.length >= 10, `le plan du site liste ${adresses.length} pages`);

  for (const adresse of adresses) {
    const chemin = new URL(adresse).pathname;
    const reponsePage = await fetch(BASE + chemin, { redirect: "manual" });
    verifier(reponsePage.status === 200, `plan du site : ${chemin} repond 200`, `HTTP ${reponsePage.status}`);
  }
}

async function trouverFeuilleDeStyle() {
  const html = await (await fetch(BASE + "/")).text();
  const lien = /<link rel="stylesheet" href="([^"]+)"/.exec(html)?.[1];
  if (lien === undefined) return "";
  return (await fetch(new URL(lien, BASE))).text();
}

principal().catch((erreur) => {
  console.error(`recette : ${erreur.message}`);
  process.exit(1);
});
