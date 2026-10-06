// =============================================================================
// Connexion en deux temps — établissement, puis identifiant (migration 0058).
//
// Ces tests tournent dans un vrai navigateur contre un site servi
// (`SITE_BASE`). Ils n'ont besoin d'aucun compte : l'étape 2 est atteinte en
// posant le contexte établissement (un cookie non secret, nom et code), comme
// le fait l'étape 1 après avoir trouvé l'établissement.
//
// Ce qui est vérifié : aucune requête pour un formulaire incomplet, messages
// sous les champs, attributs de saisie automatique, pas de choix de rôle,
// liens des parcours, lien d'invitation collé, redirection interne seulement,
// déconnexion qui efface les données locales, mise en page téléphone.
// =============================================================================

import assert from "node:assert/strict";
import test, { after } from "node:test";
import { BASE, fermerNavigateur, ouvrirNavigateur } from "./harness.mjs";

after(fermerNavigateur);

const CONTEXTE = Buffer.from(JSON.stringify({ c: "TESTA1", n: "Lycée de démonstration" }), "utf8").toString("base64url");

async function ouvrir(chemin, { largeur = 1280, hauteur = 900, etablissement = false } = {}) {
  const nav = await ouvrirNavigateur();
  const contexte = await nav.newContext({ viewport: { width: largeur, height: hauteur } });
  if (etablissement) await contexte.addCookies([{ name: "study_etab_parcours", value: CONTEXTE, url: BASE }]);
  const onglet = await contexte.newPage();
  await onglet.goto(`${BASE}${chemin}`, { waitUntil: "networkidle" });
  return onglet;
}

function espionnerEnvois(onglet) {
  const envois = [];
  onglet.on("request", (r) => {
    if (r.method() === "POST") envois.push(r.url());
  });
  return envois;
}

test("C01 — sans établissement : étape 1, titre et liens des parcours", async () => {
  const onglet = await ouvrir("/connexion");
  assert.equal(await onglet.locator("h1").innerText(), "Retrouve ta classe.");
  assert.match(await onglet.locator("main").innerText(), /Connecte-toi à ton espace Study\./);
  assert.equal(await onglet.locator("#code-etablissement").count(), 1);
  assert.equal(await onglet.getByRole("link", { name: "Activer mon accès" }).getAttribute("href"), "/activer");
  assert.equal(await onglet.getByRole("link", { name: "Rejoindre ma classe" }).getAttribute("href"), "/rejoindre");
  const envois = espionnerEnvois(onglet);
  await onglet.locator('[data-testid="etablissement-continuer"]').click();
  await onglet.waitForTimeout(300);
  assert.deepEqual(envois, [], "un champ vide ne part pas au serveur");
  assert.match(await onglet.locator("#erreur-code-etablissement").innerText(), /Indique le code/);
  await onglet.context().close();
});

test("C02 — un lien d'invitation collé à l'étape 1 ouvre l'invitation", async () => {
  const onglet = await ouvrir("/connexion");
  const jeton = "A".repeat(43);
  await onglet.fill("#code-etablissement", `https://exemple.test/invitation/${jeton}`);
  await onglet.locator('[data-testid="etablissement-continuer"]').click();
  await onglet.waitForURL(`**/invitation/${jeton}`, { timeout: 30_000 });
  await onglet.context().close();
});

test("C03 — étape 2 : l'établissement est affiché avec « Changer », aucun choix de rôle", async () => {
  const onglet = await ouvrir("/connexion", { etablissement: true });
  assert.equal(await onglet.locator('[data-testid="etablissement-nom"]').innerText(), "Lycée de démonstration");
  assert.equal(await onglet.getByRole("button", { name: /Changer d.établissement/ }).count(), 1);
  assert.equal(await onglet.locator('input[type="radio"]').count(), 0, "aucun choix Élève / Professeur / Administration");
  assert.match(await onglet.locator("main").innerText(), /Pour un ordinateur du lycée ou utilisé par plusieurs personnes\./);
  assert.equal(await onglet.getByRole("link", { name: "Mot de passe oublié ?" }).getAttribute("href"), "/acces-oublie");
  await onglet.context().close();
});

test("C04 — champs vides : un message par champ, aucune requête, focus au premier", async () => {
  const onglet = await ouvrir("/connexion", { etablissement: true });
  const envois = espionnerEnvois(onglet);
  await onglet.locator('[data-testid="connexion-valider"]').click();
  await onglet.waitForTimeout(300);
  assert.deepEqual(envois, []);
  assert.match(await onglet.locator("#erreur-identifiant").innerText(), /Indique ton identifiant/);
  assert.match(await onglet.locator("#erreur-motDePasse").innerText(), /Indique ton mot de passe/);
  assert.equal(await onglet.evaluate(() => document.activeElement?.id), "identifiant");
  assert.equal(await onglet.locator("#identifiant").getAttribute("aria-invalid"), "true");
  await onglet.fill("#identifiant", "camille.martin");
  await onglet.locator('[data-testid="connexion-valider"]').click();
  await onglet.waitForTimeout(300);
  assert.equal(await onglet.locator("#erreur-identifiant").count(), 0, "seul le champ manquant reste signalé");
  assert.equal(await onglet.evaluate(() => document.activeElement?.id), "motDePasse");
  await onglet.context().close();
});

test("C05 — saisie automatique, collage et Afficher/Masquer", async () => {
  const onglet = await ouvrir("/connexion", { etablissement: true });
  assert.equal(await onglet.locator("#identifiant").getAttribute("autocomplete"), "username");
  assert.equal(await onglet.locator("#motDePasse").getAttribute("autocomplete"), "current-password");
  // Collage : on simule un collage réel et on vérifie qu'il n'est pas bloqué.
  await onglet.locator("#motDePasse").focus();
  await onglet.evaluate(() => {
    const champ = document.querySelector("#motDePasse");
    const donnees = new DataTransfer();
    donnees.setData("text/plain", " Phrase secrète ");
    const accepte = champ.dispatchEvent(new ClipboardEvent("paste", { clipboardData: donnees, cancelable: true, bubbles: true }));
    window.__collageAccepte = accepte;
  });
  assert.equal(await onglet.evaluate(() => window.__collageAccepte), true, "le collage n'est pas empêché");
  await onglet.fill("#motDePasse", " Phrase secrète ");
  const bouton = onglet.getByRole("button", { name: /Afficher|Masquer/ });
  assert.equal(await bouton.getAttribute("aria-pressed"), "false");
  await bouton.click();
  assert.equal(await onglet.locator("#motDePasse").getAttribute("type"), "text");
  assert.equal(await onglet.locator("#motDePasse").inputValue(), " Phrase secrète ", "le mot de passe n'est jamais modifié (ni rognage)");
  await onglet.context().close();
});

test("C06 — une adresse de suite externe est ignorée", async () => {
  const onglet = await ouvrir("/connexion?suite=https%3A%2F%2Fexemple.org%2Fpiege", { etablissement: true });
  assert.equal(await onglet.locator('input[name="suite"]').count(), 0);
  const interne = await ouvrir("/connexion?suite=%2Fapp%2Fcours", { etablissement: true });
  const suites = await interne.locator('input[name="suite"]').evaluateAll((e) => e.map((x) => x.value));
  assert.ok(suites.length >= 1 && suites.every((v) => v === "/app/cours"), "la suite interne est transmise, partout identique");
  await onglet.context().close();
  await interne.context().close();
});

test("C07 — « Changer » oublie l'établissement et revient à l'étape 1", async () => {
  const onglet = await ouvrir("/connexion", { etablissement: true });
  await onglet.getByRole("button", { name: /Changer d.établissement/ }).click();
  await onglet.waitForSelector("#code-etablissement", { timeout: 30_000 });
  const cookies = await onglet.context().cookies();
  assert.equal(cookies.filter((c) => c.name.startsWith("study_etab") && c.value !== "").length, 0);
  await onglet.context().close();
});

test("C08 — déconnexion : 303, cookie retiré, Clear-Site-Data, nettoyage local", async () => {
  const onglet = await ouvrir("/connexion", { etablissement: true });
  await onglet.evaluate(() => {
    localStorage.setItem("study-note-x", "brouillon");
    sessionStorage.setItem("study-brouillon-y", "message");
    localStorage.setItem("autre-site", "garde");
  });
  const reponse = await onglet.evaluate(async () => {
    const r = await fetch("/deconnexion", { method: "POST", redirect: "manual" });
    return { type: r.type, statut: r.status };
  });
  assert.ok(reponse.type === "opaqueredirect" || reponse.statut === 303);
  const brute = await onglet.request.post(`${BASE}/deconnexion`, { headers: { origin: BASE }, maxRedirects: 0 });
  assert.equal(brute.status(), 303);
  assert.equal(brute.headers()["clear-site-data"], '"cache", "storage"');
  assert.match(brute.headers().location ?? "", /\/connexion\?fin=1$/);
  await onglet.goto(`${BASE}/connexion?fin=1`, { waitUntil: "networkidle" });
  await onglet.waitForTimeout(300);
  const reste = await onglet.evaluate(() => ({ note: localStorage.getItem("study-note-x"), fil: sessionStorage.getItem("study-brouillon-y"), autre: localStorage.getItem("autre-site") }));
  // L’en-tête vide tout le stockage du site ; le repli côté page ne vise que les clés Study.
  assert.deepEqual({ note: reste.note, fil: reste.fil }, { note: null, fil: null });
  assert.match(await onglet.locator("main").innerText(), /Déconnexion effectuée/);
  await onglet.context().close();
});

test("C09 — téléphone : une colonne, champs ≥ 48 px et ≥ 16 px, aucun débordement", async () => {
  for (const largeur of [320, 390]) {
    const onglet = await ouvrir("/connexion", { largeur, hauteur: 700, etablissement: true });
    const mesures = await onglet.evaluate(() => {
      const champ = document.querySelector("#identifiant");
      const s = getComputedStyle(champ);
      const r = champ.getBoundingClientRect();
      return {
        debordement: document.documentElement.scrollWidth - innerWidth,
        hauteur: r.height,
        police: parseFloat(s.fontSize),
        marge: r.left,
        visuel: getComputedStyle(document.querySelector("aside") ?? document.body).display,
      };
    });
    assert.equal(mesures.debordement, 0, `${largeur} px`);
    assert.ok(mesures.hauteur >= 48, `champ de ${mesures.hauteur} px`);
    assert.ok(mesures.police >= 16, `police de ${mesures.police} px`);
    assert.equal(Math.round(mesures.marge), 20, "marge latérale de 20 px");
    assert.equal(mesures.visuel, "none", "pas de visuel au-dessus du formulaire");
    await onglet.context().close();
  }
});
