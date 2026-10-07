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

/* ------------------------------------------------ R2 — landing sans 3D ---- */

test("L01 — un seul hero, sans scène 3D, message et accès visibles au premier rendu", async () => {
  const onglet = await page("/");
  assert.equal(await onglet.locator("h1").count(), 1, "un seul H1");
  assert.equal(await onglet.locator("h1").innerText(), "Ta classe, tout simplement.");
  assert.equal(await onglet.locator("canvas").count(), 0, "aucun canvas");
  assert.equal(await onglet.getByText("Passer l'introduction").count(), 0, "aucun lien Passer");
  assert.equal(await onglet.getByRole("link", { name: "Découvrir Study" }).getAttribute("href"), "#decouvrir");
  const connexion = onglet.locator("main").getByRole("link", { name: "Se connecter" }).first();
  assert.equal(await connexion.getAttribute("href"), "/connexion");
  assert.equal(await connexion.isVisible(), true);
  await onglet.close();
});

test("L02 — le sélecteur de matière change d'exemple, au clavier aussi", async () => {
  const onglet = await page("/");
  const visible = async () =>
    onglet.evaluate(() => [...document.querySelectorAll(".exemple-panneau")].filter((n) => getComputedStyle(n).display !== "none").map((n) => n.getAttribute("data-matiere")));
  assert.deepEqual(await visible(), ["maths"], "un seul panneau au départ");
  await onglet.locator('input[name="exemple-matiere"][value="maths"]').focus();
  await onglet.keyboard.press("ArrowRight");
  await onglet.waitForTimeout(150);
  assert.deepEqual(await visible(), ["histoire"], "la flèche passe à la matière suivante");
  await onglet.locator("label.exemple-matiere", { hasText: "Anglais" }).click();
  await onglet.waitForTimeout(150);
  assert.deepEqual(await visible(), ["anglais"]);
  await onglet.close();
});

test("L03 — sections du cahier R2, dans l'ordre", async () => {
  const onglet = await page("/");
  const titres = await onglet.locator("main h2").allInnerTexts();
  const attendus = [
    "Le bon cours. Au bon moment.",
    "Une question ne devrait pas te bloquer.",
    "Préparez une fois. Partagez à la bonne classe.",
    "Votre établissement, simplement.",
    "Les questions qu'on nous pose.",
    "Une classe qui avance ensemble.",
  ];
  let position = -1;
  for (const t of attendus) {
    const i = titres.findIndex((x) => x.replace(/[’]/g, "'").trim() === t);
    assert.ok(i > position, `« ${t} » présent et après la section précédente`);
    position = i;
  }
  await onglet.close();
});

test("L04 — la FAQ s'ouvre au clavier, lignes d'au moins 56 px", async () => {
  const onglet = await page("/");
  const resume = onglet.locator("details[name='faq'] > summary").first();
  const boite = await resume.boundingBox();
  assert.ok(boite && boite.height >= 56, "ligne interactive d'au moins 56 px");
  await resume.focus();
  await onglet.keyboard.press("Enter");
  await onglet.waitForTimeout(250);
  assert.equal(await onglet.locator("details[name='faq']").first().evaluate((d) => d.open), true);
  await onglet.close();
});

/* ----------------------------------------------------- §2 Navigation ------ */

test("N01 — a 1366 px, seule la navigation de bureau est parcourue", async () => {
  const onglet = await page("/", { largeur: 1366 });

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
  const onglet = await page("/", { largeur: 390, hauteur: 844 });

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
  const onglet = await page("/", { largeur: 390, hauteur: 844 });
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
  const onglet = await page("/", { largeur: 390, hauteur: 844 });

  const surface = await onglet.evaluate(() => {
    const nav = document.querySelector('header nav[aria-label="Navigation principale"]');
    if (nav === null) return 0;
    const boite = nav.getBoundingClientRect();
    return boite.width * boite.height;
  });

  assert.equal(surface, 0, "la navigation de bureau n occupe aucune surface");
  await onglet.close();
});

/* ------------------------------------------------------ §7 Demonstration -- */

test("D01 — la demonstration est annoncee comme fictive", async () => {
  const onglet = await page("/");
  const texte = await onglet.evaluate(() => document.body.innerText);

  assert.match(texte, /Exemple de présentation/, "la mention accompagne l apercu du hero");
  assert.match(texte, /Exemple illustratif/, "les autres exemples sont nommes comme tels");
  assert.equal(
    /Bonjour Rayan/.test(texte),
    false,
    "aucun prenom lie au projet ne figure dans la vitrine",
  );

  await onglet.close();
});
