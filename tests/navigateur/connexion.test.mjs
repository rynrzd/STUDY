// =============================================================================
// Le formulaire de connexion — cahier V5, §4.
//
// Le défaut observé en production : ouvrir /connexion, ne rien remplir,
// cliquer. Le bouton passait à « Vérification… », une requête partait, et la
// réponse était « Code établissement, identifiant ou mot de passe incorrect ».
//
// Deux problèmes dans cette phrase. Elle est fausse — rien n'était incorrect,
// tout était vide. Et elle coûte une tentative sur le compteur de limitation
// du serveur, pour une faute de frappe.
//
// La cause : le `<form>` porte `noValidate`, pour écrire ses propres messages
// plutôt que ceux du navigateur, mais rien ne remplaçait la validation native.
// =============================================================================

import assert from "node:assert/strict";
import test, { after } from "node:test";
import { fermerNavigateur, page } from "./harness.mjs";

after(fermerNavigateur);

/** Compte les envois d'action serveur partis de la page. */
function espionnerEnvois(onglet) {
  const envois = [];
  onglet.on("request", (requete) => {
    if (requete.method() === "POST") envois.push(requete.url());
  });
  return envois;
}

test("C01 — un formulaire vide ne declenche aucune requete", async () => {
  const onglet = await page("/connexion");
  const envois = espionnerEnvois(onglet);

  await onglet.locator('button[type="submit"]').first().click();
  await onglet.waitForTimeout(1500);

  assert.deepEqual(envois, [], "aucune action serveur ne doit partir sur un formulaire vide");

  await onglet.close();
});

test("C02 — chaque champ vide recoit son propre message", async () => {
  const onglet = await page("/connexion");

  await onglet.locator('button[type="submit"]').first().click();
  await onglet.waitForTimeout(500);

  const texte = await onglet.evaluate(() => document.body.innerText);

  assert.match(texte, /Indiquez le code de votre établissement/);
  assert.match(texte, /Indiquez votre identifiant/);
  assert.match(texte, /Indiquez votre mot de passe/);

  // Et surtout pas le message generique, qui laisserait croire a un compte
  // ou un mot de passe faux.
  assert.equal(
    /incorrect/i.test(texte),
    false,
    "un champ vide n est pas un identifiant incorrect",
  );

  await onglet.close();
});

test("C03 — le resume est annonce et les champs sont marques invalides", async () => {
  const onglet = await page("/connexion");

  await onglet.locator('button[type="submit"]').first().click();
  await onglet.waitForTimeout(500);

  const etat = await onglet.evaluate(() => {
    const invalides = [...document.querySelectorAll('[aria-invalid="true"]')].map((e) => e.name);
    const alerte = document.querySelector('[role="alert"]');

    // Chaque champ invalide doit pointer un message qui existe vraiment.
    const decrits = invalides.map((nom) => {
      const champ = document.querySelector(`[name="${nom}"]`);
      const ids = (champ?.getAttribute("aria-describedby") ?? "").split(/\s+/).filter(Boolean);
      return {
        nom,
        messageTrouve: ids.some((id) => (document.getElementById(id)?.textContent ?? "").trim() !== ""),
      };
    });

    return {
      invalides,
      alerte: (alerte?.textContent ?? "").trim().slice(0, 80),
      decrits,
      focus: document.activeElement?.getAttribute("name") ?? null,
    };
  });

  assert.deepEqual(
    etat.invalides.sort(),
    ["code", "identifiant", "motDePasse"],
    "les trois champs sont marques invalides",
  );
  assert.notEqual(etat.alerte, "", "un resume est annonce par role=alert");
  for (const champ of etat.decrits) {
    assert.equal(champ.messageTrouve, true, `${champ.nom} pointe un message existant`);
  }
  assert.equal(etat.focus, "code", "le focus va au premier champ fautif");

  await onglet.close();
});

test("C04 — un seul champ vide ne signale que celui-la", async () => {
  const onglet = await page("/connexion");

  await onglet.locator('[name="code"]').fill("LYCEE-EXEMPLE");
  await onglet.locator('[name="identifiant"]').fill("prenom.nom");
  await onglet.locator('button[type="submit"]').first().click();
  await onglet.waitForTimeout(500);

  const etat = await onglet.evaluate(() => ({
    invalides: [...document.querySelectorAll('[aria-invalid="true"]')].map((e) => e.name),
    focus: document.activeElement?.getAttribute("name") ?? null,
  }));

  assert.deepEqual(etat.invalides, ["motDePasse"]);
  assert.equal(etat.focus, "motDePasse", "le focus va au champ qui manque");

  await onglet.close();
});

test("C05 — les champs portent les bons attributs de saisie automatique", async () => {
  const onglet = await page("/connexion");

  const attributs = await onglet.evaluate(() =>
    Object.fromEntries(
      [...document.querySelectorAll("input[name]")]
        .filter((e) => e.type !== "hidden")
        .map((e) => [e.name, e.getAttribute("autocomplete")]),
    ),
  );

  assert.equal(attributs.code, "organization");
  assert.equal(attributs.identifiant, "username");
  assert.equal(attributs.motDePasse, "current-password");

  await onglet.close();
});

test("C06 — le bouton Afficher annonce son etat", async () => {
  const onglet = await page("/connexion");

  const bouton = onglet.locator("button", { hasText: /Afficher|Masquer/ }).first();
  const champ = onglet.locator('[name="motDePasse"]');

  assert.equal(await bouton.getAttribute("aria-pressed"), "false");
  assert.equal(await champ.getAttribute("type"), "password");

  await bouton.click();
  await onglet.waitForTimeout(200);

  assert.equal(await bouton.getAttribute("aria-pressed"), "true");
  assert.equal(await champ.getAttribute("type"), "text");

  await onglet.close();
});
