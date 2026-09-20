// =============================================================================
// Le socle navigateur connecté — §1 à §9 du cahier.
//
// Trois exigences gouvernent ce fichier, et chacune vient d'une erreur déjà
// commise.
//
// **On vérifie l'origine, à chaque page.** Une recette qui charge
// `localhost:3100` ou une préversion Vercel mesure autre chose que le produit
// livré, et le dit avec assurance. `exigerPage()` refuse toute origine autre
// que celle annoncée.
//
// **On refuse une page d'erreur.** Un navigateur qui n'a pas pu joindre le
// site affiche la sienne ; l'application a la sienne. Mesurer l'une ou l'autre
// en croyant mesurer un écran produit fabrique des défauts imaginaires — cela
// s'est produit, et cela a coûté une demi-journée d'analyse.
//
// **On ne choisit jamais un élément par « le premier qui porte ce texte ».**
// Deux boutons « Enregistrer » coexistent dans le Studio. Un script qui prend
// le premier teste ce qu'il trouve, pas ce qu'il vise. Tout passe par
// `data-testid`.
//
// Les secrets — mots de passe temporaires, clés TOTP lues à l'écran — ne sont
// ni affichés, ni journalisés, ni écrits sur disque. Ils traversent la mémoire
// le temps d'une connexion.
// =============================================================================

import { chromium } from "playwright-core";
import { codeStable } from "./totp.mjs";

/** Les textes qui trahissent une page d'erreur, la nôtre ou celle du navigateur. */
const SIGNES_D_ERREUR = [
  "Le service n'a pas pu répondre",
  "Signaler le problème",
  "ERR_CONNECTION",
  "ERR_NAME_NOT_RESOLVED",
  "Cette page ne fonctionne pas",
  "This site can",
];

export async function ouvrirNavigateur() {
  const canal = process.env.NAVIGATEUR_RECETTE ?? "msedge";
  return chromium.launch({ channel: canal });
}

/**
 * Ouvre une page et **prouve** que c'est la bonne.
 *
 * `attendu` est un chemin (ou une expression régulière) que l'adresse finale
 * doit satisfaire après d'éventuelles redirections ; `marqueur` un sélecteur
 * qui n'existe que sur l'écran visé. Sans ce second contrôle, une redirection
 * silencieuse vers la connexion passerait pour un succès.
 */
export async function exigerPage(page, base, chemin, { attendu = null, marqueur = null, essais = 3 } = {}) {
  const cible = `${base}${chemin}`;
  let dernier = "";

  for (let essai = 1; essai <= essais; essai += 1) {
    try {
      const reponse = await page.goto(cible, { waitUntil: "networkidle", timeout: 30_000 });
      const statut = reponse?.status() ?? 0;
      if (statut >= 400) {
        dernier = `HTTP ${statut}`;
        continue;
      }

      const verdict = await verifierEcran(page, base, { attendu, marqueur });
      if (verdict === null) return page;
      dernier = verdict;
    } catch (erreur) {
      dernier = erreur.message.split("\n")[0];
    }
  }

  throw new Error(`${chemin} : ${dernier}`);
}

/**
 * Ce que la page affiche est-il acceptable ? `null` si oui, le motif sinon.
 *
 * À appeler aussi après une navigation provoquée par un clic — c'est là que
 * les mauvaises surprises arrivent, pas sur les `goto`.
 */
export async function verifierEcran(page, base, { attendu = null, marqueur = null } = {}) {
  const adresse = page.url();

  if (!adresse.startsWith(base)) {
    return `origine inattendue — ${new URL(adresse).origin} au lieu de ${base}`;
  }

  const texte = await page.evaluate(() => document.body?.innerText ?? "");
  for (const signe of SIGNES_D_ERREUR) {
    if (texte.includes(signe)) return `page d erreur affichee (« ${signe} »)`;
  }

  if (attendu !== null) {
    const chemin = new URL(adresse).pathname;
    const ok = attendu instanceof RegExp ? attendu.test(chemin) : chemin === attendu;
    if (!ok) return `adresse inattendue — ${chemin} au lieu de ${attendu}`;
  }

  if (marqueur !== null && (await page.locator(marqueur).count()) === 0) {
    return `marqueur absent — ${marqueur}`;
  }

  return null;
}

/**
 * Connecte un compte, en traversant tout ce que le produit peut exiger.
 *
 * Trois étapes possibles, dans l'ordre où le produit les impose : le mot de
 * passe, l'activation (choix d'un mot de passe définitif), le second facteur.
 * Une recette qui ne traiterait que la première ne pourrait pas ouvrir un
 * compte d'administration — c'est-à-dire la moitié du produit.
 *
 * Rend la destination atteinte et, si un second facteur a été enrôlé, sa clé —
 * **en mémoire seulement**, pour que l'appelant puisse se reconnecter. Elle
 * n'est jamais journalisée.
 */
export async function connecter(page, base, identite) {
  const { code, login, motDePasse, motDePasseFinal = null } = identite;

  await exigerPage(page, base, "/connexion", { attendu: "/connexion", marqueur: "#identifiant" });

  await page.fill("#code", code);
  await page.fill("#identifiant", login);
  await page.fill("#motDePasse", motDePasse);
  await Promise.all([
    page.waitForLoadState("networkidle"),
    page.click('[data-testid="connexion-valider"]'),
  ]);

  let secretTotp = identite.secretTotp ?? null;
  let motDePasseCourant = motDePasse;

  // L'activation : le mot de passe temporaire doit être remplacé avant tout.
  if (page.url().includes("/activation")) {
    const definitif = motDePasseFinal ?? `Definitif-${Math.random().toString(36).slice(2, 12)}!aA1`;
    await page.fill("#nouveau", definitif);
    await page.fill("#confirmation", definitif);
    await Promise.all([
      page.waitForLoadState("networkidle"),
      page.click('[data-testid="activation-valider"]'),
    ]);
    motDePasseCourant = definitif;
  }

  // Le second facteur : enrôlement si la clé n'est pas encore connue, simple
  // vérification sinon.
  if (page.url().includes("/second-facteur")) {
    if (secretTotp === null) {
      const affichee = await page.locator('[data-testid="cle-totp"]').textContent();
      if (affichee === null || affichee.trim() === "") {
        throw new Error("second facteur : aucune cle presentee a l enrolement");
      }
      secretTotp = affichee.replace(/\s/g, "");
    }

    await page.fill("#code", await codeStable(secretTotp));
    await Promise.all([
      page.waitForLoadState("networkidle"),
      page.click('[data-testid="totp-valider"]'),
    ]);

    const continuer = page.locator('a:has-text("Continuer")');
    if ((await continuer.count()) > 0) {
      await Promise.all([page.waitForLoadState("networkidle"), continuer.click()]);
    }
  }

  const probleme = await verifierEcran(page, base);
  if (probleme !== null) throw new Error(`connexion de ${login} : ${probleme}`);

  if (page.url().includes("/connexion")) {
    throw new Error(`connexion de ${login} : refusee, on reste sur l ecran de connexion`);
  }

  return { destination: new URL(page.url()).pathname, secretTotp, motDePasse: motDePasseCourant };
}

/** Ferme la session côté serveur, comme le ferait la personne. */
export async function deconnecter(page, base) {
  await page.goto(`${base}/deconnexion`, { waitUntil: "networkidle" }).catch(() => {});
  await page.context().clearCookies();
}

/**
 * Un contexte navigateur par personne.
 *
 * Deux élèves partageant un contexte partageraient leurs cookies : le second
 * prendrait la session du premier, et l'isolation testée serait une illusion.
 */
export async function contexteDe(navigateur) {
  const contexte = await navigateur.newContext({ viewport: { width: 1280, height: 900 } });
  return { contexte, page: await contexte.newPage() };
}
