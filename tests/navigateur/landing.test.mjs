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
  cliquerOnglet,
  estHydratee,
  fermerNavigateur,
  page,
  panneauVisible,
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

/* -------------------------------------------------------- §1.1 Situations -- */

test("L01 — les trois onglets d usage changent de panneau", async () => {
  const onglet = await page("/");
  const groupe = "Situations d'usage";

  const depart = await panneauVisible(onglet, groupe);
  assert.equal(depart?.onglet, "Sur ordinateur", "« Sur ordinateur » est selectionne au depart");
  assert.equal(depart?.visible, true);
  assert.equal(depart?.autresPanneauxVisibles, 0, "un seul panneau a la fois");

  const vus = new Map([[depart.onglet, depart.texte]]);

  for (const libelle of ["Sur papier", "À la maison"]) {
    await cliquerOnglet(onglet, groupe, libelle);
    const etat = await panneauVisible(onglet, groupe);

    assert.equal(etat?.onglet, libelle, `« ${libelle} » devient l onglet selectionne`);
    assert.equal(etat?.visible, true, `le panneau de « ${libelle} » est visible`);
    assert.equal(etat?.autresPanneauxVisibles, 0, "jamais deux panneaux en meme temps");
    assert.ok(etat.texte.length > 40, "le panneau porte un contenu");

    for (const [autre, texte] of vus) {
      assert.notEqual(
        etat.texte,
        texte,
        `« ${libelle} » doit differer de « ${autre} », pas seulement changer de couleur`,
      );
    }
    vus.set(libelle, etat.texte);
  }

  await onglet.close();
});

test("L02 — les fleches du clavier changent d onglet", async () => {
  const onglet = await page("/");
  const groupe = "Situations d'usage";

  await onglet
    .locator(`[role="tablist"][aria-label="${groupe}"] [role="tab"]`)
    .first()
    .focus();

  await onglet.keyboard.press("ArrowRight");
  await onglet.waitForTimeout(200);
  assert.equal((await panneauVisible(onglet, groupe))?.onglet, "Sur papier");

  await onglet.keyboard.press("ArrowRight");
  await onglet.waitForTimeout(200);
  assert.equal((await panneauVisible(onglet, groupe))?.onglet, "À la maison");

  // Au bout, on revient au debut : c est ce qu attend un lecteur d ecran.
  await onglet.keyboard.press("ArrowRight");
  await onglet.waitForTimeout(200);
  assert.equal((await panneauVisible(onglet, groupe))?.onglet, "Sur ordinateur");

  await onglet.keyboard.press("ArrowLeft");
  await onglet.waitForTimeout(200);
  assert.equal((await panneauVisible(onglet, groupe))?.onglet, "À la maison");

  await onglet.close();
});

/* ------------------------------------------------------- §1.2 Mes classes -- */

test("L03 — Seconde 1 et Seconde 2 montrent des donnees differentes", async () => {
  const onglet = await page("/");
  const groupe = "Mes classes";

  const premiere = await panneauVisible(onglet, groupe);
  assert.equal(premiere?.onglet, "Seconde 1");
  assert.match(premiere.texte, /Chapitre 3/, "Seconde 1 porte son chapitre");

  await cliquerOnglet(onglet, groupe, "Seconde 2");
  const seconde = await panneauVisible(onglet, groupe);

  assert.equal(seconde?.onglet, "Seconde 2", "aria-selected suit le clic");
  assert.notEqual(seconde.texte, premiere.texte, "le contenu change vraiment");
  assert.match(seconde.texte, /Chapitre 2/, "Seconde 2 porte un autre chapitre");
  assert.equal(seconde.autresPanneauxVisibles, 0);

  await cliquerOnglet(onglet, groupe, "Seconde 1");
  assert.equal((await panneauVisible(onglet, groupe))?.texte, premiere.texte, "le retour marche");

  await onglet.close();
});

/* ---------------------------------------------------- §1.3 Vue du devoir -- */

test("L04 — Devoir, Ma copie et Entraide sont trois panneaux distincts", async () => {
  const onglet = await page("/");
  const groupe = "Vue du devoir";

  const textes = new Map();

  for (const libelle of ["Devoir", "Ma copie", "Entraide"]) {
    await cliquerOnglet(onglet, groupe, libelle);
    const etat = await panneauVisible(onglet, groupe);

    assert.equal(etat?.onglet, libelle);
    assert.equal(etat?.visible, true);
    assert.equal(etat?.autresPanneauxVisibles, 0);
    textes.set(libelle, etat.texte);
  }

  assert.match(textes.get("Devoir"), /rendre/i, "le devoir porte une echeance");
  assert.match(textes.get("Ma copie"), /brouillon|remis|enregistr/i, "la copie porte son etat");
  assert.match(textes.get("Entraide"), /\?/, "l entraide porte une question");

  const distincts = new Set(textes.values());
  assert.equal(distincts.size, 3, "les trois panneaux different");

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

  assert.match(texte, /Aperçu fictif de l'espace élève/, "la mention accompagne l apercu");
  assert.equal(
    /Bonjour Rayan/.test(texte),
    false,
    "aucun prenom lie au projet ne figure dans la vitrine",
  );

  await onglet.close();
});
