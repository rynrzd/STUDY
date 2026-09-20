// =============================================================================
// Métadonnées d'indexation — cahier V5, §3.
//
// Le défaut observé : /connexion et /mot-de-passe-oublie se déclaraient
// canoniques vers l'accueil, et les onze pages publiques annonçaient la même
// adresse Open Graph.
//
// La cause tenait en deux lignes du gabarit racine — `alternates.canonical` et
// `openGraph.url` — héritées par toute page qui ne les redéfinissait pas. Un
// oubli silencieux : aucune page ne « déclarait » être l'accueil, elle héritait
// simplement de quelqu'un qui l'était.
//
// Ces contrôles n'ouvrent pas de navigateur : ils lisent le HTML servi, ce qui
// est exactement ce qu'un moteur fait.
// =============================================================================

import assert from "node:assert/strict";
import test from "node:test";
import { BASE } from "./harness.mjs";

/** Les pages publiques, indexables, avec leur adresse canonique attendue. */
const PUBLIQUES = [
  "/",
  "/produit",
  "/etablissements",
  "/offre",
  "/securite",
  "/aide",
  "/contact",
  "/accessibilite",
  "/mentions-legales",
  "/confidentialite",
  "/conditions",
];

/** Les pages qui n'ont rien à faire dans un index. */
const PRIVEES = ["/connexion", "/mot-de-passe-oublie"];

async function metadonnees(chemin) {
  const reponse = await fetch(`${BASE}${chemin}`, { redirect: "manual" });
  const html = await reponse.text();
  const lire = (motif) => html.match(motif)?.[1] ?? null;

  return {
    statut: reponse.status,
    titre: lire(/<title>([^<]*)<\/title>/),
    description: lire(/<meta[^>]+name="description"[^>]+content="([^"]*)"/),
    canonique: lire(/<link[^>]+rel="canonical"[^>]+href="([^"]*)"/),
    robots: lire(/<meta[^>]+name="robots"[^>]+content="([^"]*)"/),
    ogUrl: lire(/<meta[^>]+property="og:url"[^>]+content="([^"]*)"/),
    ogTitre: lire(/<meta[^>]+property="og:title"[^>]+content="([^"]*)"/),
    ogDescription: lire(/<meta[^>]+property="og:description"[^>]+content="([^"]*)"/),
    ogImage: lire(/<meta[^>]+property="og:image"[^>]+content="([^"]*)"/),
  };
}

test("S01 — chaque page publique est canonique d elle-meme", async () => {
  for (const chemin of PUBLIQUES) {
    const meta = await metadonnees(chemin);
    const attendue = chemin === "/" ? "" : chemin;

    assert.equal(meta.statut, 200, `${chemin} repond 200`);
    assert.ok(meta.canonique !== null, `${chemin} declare une canonique`);
    assert.equal(
      new URL(meta.canonique).pathname.replace(/\/$/, ""),
      attendue,
      `${chemin} doit etre canonique d elle-meme, pas de « ${meta.canonique} »`,
    );
  }
});

test("S02 — chaque page publique annonce sa propre adresse sociale", async () => {
  const vues = new Set();

  for (const chemin of PUBLIQUES) {
    const meta = await metadonnees(chemin);

    assert.ok(meta.ogUrl !== null, `${chemin} declare une adresse Open Graph`);
    assert.equal(
      new URL(meta.ogUrl).pathname.replace(/\/$/, ""),
      chemin === "/" ? "" : chemin,
      `${chemin} annonce sa propre adresse, pas celle d une autre page`,
    );

    assert.equal(vues.has(meta.ogUrl), false, `${meta.ogUrl} est annoncee deux fois`);
    vues.add(meta.ogUrl);

    assert.ok(meta.ogTitre !== null && meta.ogTitre !== "", `${chemin} a un titre social`);
    assert.ok(meta.ogDescription !== null, `${chemin} a une description sociale`);
    assert.ok(meta.ogImage !== null, `${chemin} a une image sociale`);
  }
});

test("S03 — titres et descriptions sont uniques", async () => {
  const titres = new Map();
  const descriptions = new Map();

  for (const chemin of PUBLIQUES) {
    const meta = await metadonnees(chemin);

    assert.ok(meta.titre !== null && meta.titre !== "", `${chemin} a un titre`);
    assert.ok(meta.description !== null && meta.description !== "", `${chemin} a une description`);

    const dejaTitre = titres.get(meta.titre);
    assert.equal(dejaTitre, undefined, `« ${meta.titre} » sert a ${dejaTitre} et a ${chemin}`);
    titres.set(meta.titre, chemin);

    const dejaDesc = descriptions.get(meta.description);
    assert.equal(dejaDesc, undefined, `la meme description sert a ${dejaDesc} et a ${chemin}`);
    descriptions.set(meta.description, chemin);
  }
});

test("S04 — les pages privees refusent l indexation sans se dire canoniques", async () => {
  for (const chemin of PRIVEES) {
    const meta = await metadonnees(chemin);

    assert.match(meta.robots ?? "", /noindex/, `${chemin} est en noindex`);
    assert.match(meta.robots ?? "", /nofollow/, `${chemin} est en nofollow`);
    assert.equal(
      meta.canonique,
      null,
      `${chemin} ne doit declarer aucune canonique, et surtout pas « ${meta.canonique} »`,
    );
  }
});

test("S05 — le plan du site ne contient aucune route privee", async () => {
  const sitemap = await (await fetch(`${BASE}/sitemap.xml`)).text();
  const adresses = [...sitemap.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);

  assert.ok(adresses.length > 0, "le plan du site n est pas vide");

  const privees = adresses.filter((adresse) =>
    /\/(admin|administration|professeur|eleve|studio|app|connexion|activation|parametres|documents|mot-de-passe-oublie)/.test(
      new URL(adresse).pathname,
    ),
  );

  assert.deepEqual(privees, [], "aucune route privee ne doit figurer dans le plan du site");

  // Et l inverse : les pages publiques y sont bien.
  const chemins = adresses.map((a) => new URL(a).pathname.replace(/\/$/, ""));
  for (const attendue of ["/produit", "/offre", "/securite", "/mentions-legales"]) {
    assert.ok(chemins.includes(attendue), `${attendue} figure dans le plan du site`);
  }
});

test("S06 — robots.txt ecarte les espaces fermes", async () => {
  const robots = await (await fetch(`${BASE}/robots.txt`)).text();

  for (const chemin of ["/admin/", "/eleve/", "/professeur/", "/studio/", "/connexion", "/api/"]) {
    assert.match(
      robots,
      new RegExp(`Disallow:\\s*${chemin.replace(/\//g, "\\/")}`),
      `${chemin} est ecarte`,
    );
  }

  assert.match(robots, /Sitemap:\s*https:/, "le plan du site est annonce");
});
