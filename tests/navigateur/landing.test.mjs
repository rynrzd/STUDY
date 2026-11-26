// =============================================================================
// La landing, dans un navigateur — cahier V5 §1 et §2.
//
// Tous les défauts couverts ici ont été observés en production, et ils avaient
// une seule cause : aucun script ne s'exécutait. La CSP promettait un nonce
// que les pages prérendues ne pouvaient pas porter, et `'strict-dynamic'` fait
// ignorer `'self'` — donc rien ne se chargeait. Le site répondait 200, le HTML
// était complet, et pas un bouton ne réagissait.
//
// D'où le premier test, qui vaut pour tous les autres : l'hydratation.
// =============================================================================

import assert from "node:assert/strict";
import test, { after } from "node:test";
import {
  estHydratee,
  fermerNavigateur,
  page,
} from "./harness.mjs";

after(fermerNavigateur);

test("H01 — la page d accueil s hydrate reellement", async () => {
  const onglet = await page("/");
  const erreurs = [];
  onglet.on("console", (m) => {
    if (m.type() === "error") erreurs.push(m.text().slice(0, 160));
  });
  await onglet.reload({ waitUntil: "networkidle" });

  assert.equal(
    await estHydratee(onglet),
    true,
    "aucun noeud ne porte de cle React : le JavaScript ne s execute pas",
  );

  const refusCsp = erreurs.filter((e) => /Content Security Policy/i.test(e));
  assert.deepEqual(refusCsp, [], "des scripts sont refuses par la CSP");

  await onglet.close();
});

/* ------------------------------------------- Accueil immersif ---------- */

const norm = (t) => t.replace(/[’]/g, "'").replace(/\s+/g, " ").trim();
const champ = (onglet) => onglet.getByRole("searchbox", { name: "Rechercher une matière ou une notion" });

test("L01 — accueil, recherche et connexion au premier rendu", async () => {
  const onglet = await page("/");
  assert.equal(await onglet.locator("h1").count(), 1);
  assert.equal(norm(await onglet.locator("h1").innerText()), "Tu veux travailler quoi aujourd'hui ?");
  assert.equal(await onglet.locator("canvas").count(), 0);
  assert.equal(await champ(onglet).isVisible(), true);
  const connexion = onglet.getByRole("link", { name: "Se connecter" });
  assert.equal(await connexion.getAttribute("href"), "/connexion");
  assert.equal(await connexion.isVisible(), true);
  for (const [nom, href] of [["La plateforme", "/produit"], ["Établissements", "/etablissements"]]) {
    assert.equal(await onglet.getByRole("link", { name: nom }).getAttribute("href"), href);
  }
  await onglet.close();
});

test("L02 — un visiteur cherche maths, se trompe, prend un indice puis réussit", async () => {
  const onglet = await page("/");
  await champ(onglet).fill("maths");
  await champ(onglet).press("Enter");
  await onglet.getByRole("heading", { name: /On commence/ }).waitFor();
  assert.equal(await onglet.getByText("Mathématiques", { exact: true }).isVisible(), true);
  await onglet.getByRole("button", { name: "Sinus", exact: true }).click();
  assert.equal(await onglet.getByText(/Essaie encore/).isVisible(), true);
  await onglet.getByRole("button", { name: "Voir un indice" }).click();
  assert.equal(await onglet.getByText(/Regarde l’angle marqué/).isVisible(), true);
  assert.equal(await onglet.getByRole("link", { name: "Activer mon accès" }).count(), 0);
  await onglet.getByRole("button", { name: "Cosinus", exact: true }).click();
  assert.equal(await onglet.getByText(/Cosinus = côté adjacent/).isVisible(), true);
  assert.equal(await onglet.getByRole("img", { name: /Le côté adjacent/ }).isVisible(), true);
  assert.equal(await onglet.getByRole("link", { name: "Activer mon accès" }).getAttribute("href"), "/activer");
  await onglet.close();
});

test("L03 — le sujet peut changer depuis la recherche ou les notions", async () => {
  const onglet = await page("/");
  await champ(onglet).fill("j’aimerais comprendre les probabilités");
  await champ(onglet).press("Enter");
  await onglet.getByRole("heading", { name: /dé équilibré/ }).waitFor();
  assert.equal(await onglet.getByRole("button", { name: "Probabilités" }).getAttribute("aria-pressed"), "true");
  await onglet.getByRole("button", { name: "Fonctions" }).click();
  assert.equal(await onglet.getByRole("heading", { name: "Si f(x) = 2x + 1, que vaut f(3) ?" }).isVisible(), true);
  await champ(onglet).fill("anglais");
  await champ(onglet).press("Enter");
  await onglet.getByText("Anglais", { exact: true }).waitFor();
  assert.equal(await onglet.getByRole("heading", { name: /joue au tennis/ }).isVisible(), true);
  await onglet.close();
});

test("L04 — à 390 px, la recherche sans exemple propose un sujet accessible", async () => {
  const onglet = await page("/", { largeur: 390, hauteur: 844 });
  await champ(onglet).fill("chimie");
  await champ(onglet).press("Enter");
  await onglet.getByText(/On n’a pas d’exemple/).waitFor();
  await onglet.getByRole("button", { name: "Histoire-géographie" }).click();
  await onglet.getByRole("heading", { name: /prise de la Bastille/ }).waitFor();
  assert.equal(await onglet.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await onglet.close();
});

test("L05 — calcul numerique et phrase a reconstituer sans QCM", async () => {
  const onglet = await page("/", { largeur: 390, hauteur: 844 });
  await champ(onglet).fill("fonctions");
  await champ(onglet).press("Enter");
  const nombre = onglet.getByRole("textbox", { name: "Ta réponse" });
  await nombre.fill("6");
  await onglet.getByRole("button", { name: "Vérifier" }).click();
  assert.equal(await onglet.getByText(/Pas encore/).isVisible(), true);
  await nombre.fill("7");
  await onglet.getByRole("button", { name: "Vérifier" }).click();
  assert.equal(await onglet.getByText(/f\(3\) = 2/).isVisible(), true);

  await champ(onglet).fill("anglais");
  await champ(onglet).press("Enter");
  for (const mot of ["She", "plays", "tennis", "every", "Sunday."]) {
    await onglet.getByRole("group", { name: "Mots à placer" }).getByRole("button", { name: mot, exact: true }).click();
  }
  assert.equal(await onglet.getByText(/She est le sujet/).isVisible(), true);
  assert.equal(await onglet.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await onglet.close();
});

test("L06 — la recherche français propose des méthodes avec un exemple", async () => {
  const onglet = await page("/", { largeur: 390, hauteur: 844 });
  await champ(onglet).fill("français");
  await champ(onglet).press("Enter");
  assert.equal(await onglet.getByRole("heading", { name: "Qu'est-ce que tu veux travailler ?" }).isVisible(), true);
  await onglet.getByText("Commentaire de texte", { exact: true }).click();
  await onglet.getByText("Voir un exemple de réponse").click();
  assert.equal(await onglet.getByText(/personnifie la nuit/).isVisible(), true);
  await onglet.getByRole("button", { name: "Figures de style" }).click();
  assert.equal(await onglet.getByRole("heading", { name: /figure de style reconnais-tu/ }).isVisible(), true);
  await onglet.getByRole("button", { name: "Revenir aux méthodes de français" }).click();
  assert.equal(await onglet.getByText("Dissertation", { exact: true }).isVisible(), true);
  assert.equal(await onglet.evaluate(() => document.documentElement.scrollWidth <= innerWidth), true);
  await onglet.close();
});

/* ----------------------------------------------------- §2 Navigation ------ */

test("N01 — a 1366 px, seule la navigation de bureau est parcourue", async () => {
  const onglet = await page("/produit", { largeur: 1366 });

  const arrets = [];
  for (let i = 0; i < 12; i += 1) {
    await onglet.keyboard.press("Tab");
    const a = await onglet.evaluate(() => {
      const e = document.activeElement;
      if (e === null || e === document.body) return null;
      return { texte: (e.textContent ?? "").trim().slice(0, 30), entete: e.closest("header") !== null };
    });
    if (a === null || (!a.entete && arrets.length > 0)) break;
    arrets.push(a.texte);
  }

  const compte = {};
  for (const t of arrets) compte[t] = (compte[t] ?? 0) + 1;
  const doubles = Object.entries(compte).filter(([, n]) => n > 1);

  assert.deepEqual(doubles, [], "aucun lien d en-tete n est parcouru deux fois");
  assert.ok(arrets.includes("La plateforme"), "la navigation de bureau est atteignable");
  assert.equal(
    arrets.some((t) => t.includes("Ouvrir le menu")),
    false,
    "le bouton du menu mobile n est pas atteignable sur grand ecran",
  );

  await onglet.close();
});

test("N02 — a 390 px, seul le bouton du menu est parcouru", async () => {
  const onglet = await page("/produit", { largeur: 390, hauteur: 844 });

  const arrets = [];
  for (let i = 0; i < 12; i += 1) {
    await onglet.keyboard.press("Tab");
    const a = await onglet.evaluate(() => {
      const e = document.activeElement;
      if (e === null || e === document.body) return null;
      return { texte: (e.textContent ?? "").trim().slice(0, 30), entete: e.closest("header") !== null };
    });
    if (a === null || (!a.entete && arrets.length > 0)) break;
    arrets.push(a.texte);
  }

  assert.equal(
    arrets.some((t) => t === "La plateforme"),
    false,
    "les liens de bureau ne sont pas atteignables au clavier sur telephone",
  );
  assert.ok(
    arrets.some((t) => t.includes("Ouvrir le menu")),
    "le bouton du menu est atteignable",
  );

  await onglet.close();
});

test("N03 — le menu du telephone s ouvre, se ferme et rend le focus", async () => {
  const onglet = await page("/produit", { largeur: 390, hauteur: 844 });
  const bouton = onglet.locator("header button").first();

  const taille = await bouton.boundingBox();
  assert.ok(taille.width >= 44 && taille.height >= 44, "la cible fait au moins 44 px");
  assert.equal(await bouton.getAttribute("aria-expanded"), "false");
  assert.ok((await bouton.getAttribute("aria-controls")) !== null, "aria-controls relie le menu");

  await bouton.click();
  await onglet.waitForTimeout(250);

  assert.equal(await bouton.getAttribute("aria-expanded"), "true");
  assert.equal(
    await onglet.evaluate(() => getComputedStyle(document.body).overflow),
    "hidden",
    "le fond ne defile plus sous le menu ouvert",
  );

  // Échap ferme et rend le focus au bouton.
  await onglet.keyboard.press("Escape");
  await onglet.waitForTimeout(250);
  assert.equal(await bouton.getAttribute("aria-expanded"), "false");
  assert.equal(
    await onglet.evaluate(() => document.activeElement === document.querySelector("header button")),
    true,
    "le focus revient au bouton",
  );
  assert.notEqual(
    await onglet.evaluate(() => getComputedStyle(document.body).overflow),
    "hidden",
    "le defilement est rendu",
  );

  // Un clic en dehors ferme aussi.
  await bouton.click();
  await onglet.waitForTimeout(200);
  await onglet.mouse.click(200, 760);
  await onglet.waitForTimeout(250);
  assert.equal(
    await bouton.getAttribute("aria-expanded"),
    "false",
    "un clic en dehors referme le menu",
  );

  await onglet.close();
});

test("N04 — aucun menu de bureau n est visible a 390 px", async () => {
  const onglet = await page("/produit", { largeur: 390, hauteur: 844 });

  const surface = await onglet.evaluate(() => {
    const nav = document.querySelector('header nav[aria-label="Navigation principale"]');
    if (nav === null) return 0;
    const boite = nav.getBoundingClientRect();
    return boite.width * boite.height;
  });

  assert.equal(surface, 0, "la navigation de bureau n occupe aucune surface");
  await onglet.close();
});
