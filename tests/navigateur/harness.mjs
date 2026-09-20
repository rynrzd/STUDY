// =============================================================================
// Socle des tests navigateur — AvecStudy
//
// Ils tournent dans un vrai navigateur, contre un site réellement servi. C'est
// la seule façon de répondre aux questions qui ont coûté cher : les onglets
// changent-ils de panneau ? le menu du téléphone se ferme-t-il ? un formulaire
// vide part-il au serveur ?
//
// `playwright-core` ne télécharge aucun navigateur : il pilote celui de la
// machine. Le canal se choisit par `NAVIGATEUR_RECETTE` (msedge par défaut,
// chrome ailleurs), et l'adresse par `SITE_BASE`.
// =============================================================================

import { chromium } from "playwright-core";

export const BASE = (process.env.SITE_BASE ?? "http://localhost:3100").replace(/\/+$/, "");
const CANAL = process.env.NAVIGATEUR_RECETTE ?? "msedge";

let navigateur = null;

export async function ouvrirNavigateur() {
  navigateur ??= await chromium.launch({ channel: CANAL });
  return navigateur;
}

export async function fermerNavigateur() {
  if (navigateur !== null) {
    await navigateur.close();
    navigateur = null;
  }
}

/**
 * Une page prête, à une largeur donnée.
 *
 * `networkidle` plutôt que `load` : l'hydratation de React arrive après le
 * chargement du document, et c'est précisément elle qu'on vient éprouver.
 */
export async function page(chemin, { largeur = 1280, hauteur = 900 } = {}) {
  const nav = await ouvrirNavigateur();
  const onglet = await nav.newPage();
  await onglet.setViewportSize({ width: largeur, height: hauteur });
  await onglet.goto(`${BASE}${chemin}`, { waitUntil: "networkidle" });
  return onglet;
}

/**
 * L'hydratation a-t-elle réellement eu lieu ?
 *
 * On ne se fie pas à la présence des balises `<script>` : elles sont dans le
 * HTML même quand le navigateur refuse de les exécuter. On regarde ce que seul
 * React pose — les clés `__reactFiber` sur un nœud du DOM. C'est ce contrôle
 * qui aurait attrapé la panne de CSP : le site répondait 200, le HTML était
 * complet, et pas une ligne de JavaScript ne tournait.
 */
export async function estHydratee(onglet, selecteur = "body *") {
  return onglet.evaluate((cible) => {
    for (const element of document.querySelectorAll(cible)) {
      if (Object.keys(element).some((cle) => cle.startsWith("__react"))) return true;
    }
    return false;
  }, selecteur);
}

/** Le panneau d'onglets actuellement visible, avec son texte. */
export async function panneauVisible(onglet, etiquette) {
  return onglet.evaluate((nom) => {
    const liste = [...document.querySelectorAll('[role="tablist"]')].find(
      (l) => l.getAttribute("aria-label") === nom,
    );
    if (liste === undefined) return null;

    const actif = [...liste.querySelectorAll('[role="tab"]')].find(
      (t) => t.getAttribute("aria-selected") === "true",
    );
    if (actif === undefined) return null;

    const panneau = document.getElementById(actif.getAttribute("aria-controls") ?? "");
    return {
      onglet: actif.textContent.trim(),
      texte: (panneau?.textContent ?? "").replace(/\s+/g, " ").trim(),
      visible: panneau !== null && panneau.getBoundingClientRect().height > 0,
      autresPanneauxVisibles: [...liste.querySelectorAll('[role="tab"]')]
        .filter((t) => t !== actif)
        .map((t) => document.getElementById(t.getAttribute("aria-controls") ?? ""))
        .filter((p) => p !== null && p.getBoundingClientRect().height > 0).length,
    };
  }, etiquette);
}

/** Clique sur un onglet par son intitulé exact, dans le groupe nommé. */
export async function cliquerOnglet(onglet, etiquette, libelle) {
  await onglet
    .locator(`[role="tablist"][aria-label="${etiquette}"] [role="tab"]`, { hasText: libelle })
    .filter({ hasText: new RegExp(`^${libelle.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}$`) })
    .first()
    .click();
  await onglet.waitForTimeout(220);
}
