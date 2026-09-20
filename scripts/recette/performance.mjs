#!/usr/bin/env node
// =============================================================================
// §9 — Performance, mesurée sur la production.
//
//   npm run mesurer:performance
//
// Ce que ce script mesure, et ce qu'il ne mesure pas.
//
// **Il mesure** : TTFB, FCP, LCP, CLS, le JavaScript réellement transféré, le
// nombre de requêtes, la ressource la plus lourde — en cache froid et en cache
// chaud, sur un profil de bureau et sur un profil mobile lent.
//
// **Il ne mesure pas l'INP** (Interaction to Next Paint) de façon honnête : la
// métrique demande une interaction humaine réelle, et une interaction simulée
// juste après le chargement mesure un navigateur au repos, pas une personne qui
// clique. On mesure à la place le délai de la première interaction provoquée,
// et on le nomme pour ce qu'il est.
//
// Les pages connectées ne sont pas incluses : les mesurer demanderait un compte
// permanent en production, ce que la recette refuse. Elles sont couvertes par
// les scénarios connectés, qui vérifient qu'elles répondent — pas leur vitesse.
// =============================================================================

import { chromium } from "playwright-core";
import { chargerEnv, titre } from "../_commun.mjs";

chargerEnv();

const BASE = (process.env.SITE_BASE ?? "").replace(/\/+$/, "");
if (BASE === "") {
  console.log("SITE_BASE absente : rien a mesurer.");
  process.exit(1);
}

/** Les pages publiques qui comptent : l'entrée, la décision, la connexion. */
const PAGES = ["/", "/produit", "/etablissements", "/offre", "/connexion", "/aide"];

/** Un profil mobile lent : 4G bridée, processeur quatre fois plus lent. */
const MOBILE_LENT = {
  viewport: { width: 390, height: 844 },
  reseau: { download: (1.6 * 1024 * 1024) / 8, upload: (750 * 1024) / 8, latence: 150 },
  processeur: 4,
};

async function mesurer(navigateur, chemin, { mobile = false, cacheChaud = false } = {}) {
  const contexte = await navigateur.newContext(
    mobile ? { viewport: MOBILE_LENT.viewport } : { viewport: { width: 1280, height: 800 } },
  );
  const page = await contexte.newPage();

  try {
    const session = await page.context().newCDPSession(page);
    if (mobile) {
      await session.send("Network.emulateNetworkConditions", {
        offline: false,
        downloadThroughput: MOBILE_LENT.reseau.download,
        uploadThroughput: MOBILE_LENT.reseau.upload,
        latency: MOBILE_LENT.reseau.latence,
      });
      await session.send("Emulation.setCPUThrottlingRate", { rate: MOBILE_LENT.processeur });
    }

    // Cache chaud : on charge une première fois et on jette la mesure.
    if (cacheChaud) {
      await page.goto(`${BASE}${chemin}`, { waitUntil: "networkidle" }).catch(() => {});
    }

    const ressources = [];
    page.on("response", async (reponse) => {
      const taille = Number(reponse.headers()["content-length"] ?? 0);
      ressources.push({
        url: reponse.url(),
        type: reponse.request().resourceType(),
        octets: Number.isFinite(taille) ? taille : 0,
      });
    });

    const debut = Date.now();
    const reponse = await page.goto(`${BASE}${chemin}`, { waitUntil: "load", timeout: 60_000 });
    if (reponse === null || reponse.status() >= 400) {
      return { erreur: `HTTP ${reponse?.status() ?? "injoignable"}` };
    }

    // Laisser le temps au LCP de se stabiliser : il peut changer jusqu'à la
    // première interaction.
    await page.waitForTimeout(1500);

    const vitals = await page.evaluate(
      () =>
        new Promise((resoudre) => {
          const resultat = { lcp: 0, cls: 0, fcp: 0, ttfb: 0 };

          const navigation = performance.getEntriesByType("navigation")[0];
          if (navigation !== undefined) resultat.ttfb = navigation.responseStart;

          const peinture = performance.getEntriesByName("first-contentful-paint")[0];
          if (peinture !== undefined) resultat.fcp = peinture.startTime;

          try {
            for (const entree of performance.getEntriesByType("largest-contentful-paint")) {
              resultat.lcp = Math.max(resultat.lcp, entree.startTime);
            }
            const observateur = new PerformanceObserver((liste) => {
              for (const entree of liste.getEntries()) {
                if (!entree.hadRecentInput) resultat.cls += entree.value;
              }
            });
            observateur.observe({ type: "layout-shift", buffered: true });
          } catch {
            /* métriques indisponibles sur ce navigateur */
          }

          setTimeout(() => resoudre(resultat), 400);
        }),
    );

    // Le délai de la première interaction provoquée. Ce n'est pas l'INP, et le
    // rapport ne prétendra pas que ça l'est.
    const cible = page.locator("a, button").first();
    let interaction = null;
    if ((await cible.count()) > 0) {
      const avant = Date.now();
      await cible.hover().catch(() => {});
      await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => r(null))));
      interaction = Date.now() - avant;
    }

    const js = ressources.filter((r) => r.type === "script");
    const plusLourde = ressources.reduce((max, r) => (r.octets > (max?.octets ?? 0) ? r : max), null);

    return {
      total: Date.now() - debut,
      ttfb: Math.round(vitals.ttfb),
      fcp: Math.round(vitals.fcp),
      lcp: Math.round(vitals.lcp),
      cls: Number(vitals.cls.toFixed(3)),
      interaction,
      requetes: ressources.length,
      jsOctets: js.reduce((somme, r) => somme + r.octets, 0),
      plusLourde:
        plusLourde === null
          ? null
          : { nom: plusLourde.url.split("/").pop()?.slice(0, 32) ?? "", octets: plusLourde.octets },
    };
  } finally {
    await contexte.close();
  }
}

/* -------------------------------------------------------------------------- */

titre(`AvecStudy — performance\n${BASE}`);

const canal = process.env.NAVIGATEUR_RECETTE ?? "msedge";
const navigateur = await chromium.launch({ channel: canal });

// Les seuils des Core Web Vitals, tels que les publie le Chrome UX Report.
const SEUILS = { lcp: 2500, fcp: 1800, cls: 0.1, ttfb: 800 };

let alertes = 0;

try {
  console.log("\nCache froid, poste de bureau");
  console.log("  page              TTFB    FCP    LCP    CLS   requetes   JS");

  const froid = new Map();
  for (const chemin of PAGES) {
    const m = await mesurer(navigateur, chemin);
    froid.set(chemin, m);

    if (m.erreur !== undefined) {
      console.log(`  ${chemin.padEnd(16)} ${m.erreur}`);
      alertes += 1;
      continue;
    }

    const ko = (octets) => `${Math.round(octets / 1024)} Ko`;
    console.log(
      `  ${chemin.padEnd(16)} ${String(m.ttfb).padStart(4)}ms ${String(m.fcp).padStart(5)}ms ` +
        `${String(m.lcp).padStart(5)}ms ${String(m.cls).padStart(6)} ${String(m.requetes).padStart(8)}   ${ko(m.jsOctets)}`,
    );

    for (const [nom, valeur, seuil] of [
      ["LCP", m.lcp, SEUILS.lcp],
      ["FCP", m.fcp, SEUILS.fcp],
      ["CLS", m.cls, SEUILS.cls],
      ["TTFB", m.ttfb, SEUILS.ttfb],
    ]) {
      if (valeur > seuil) {
        alertes += 1;
        console.log(`      ! ${nom} au-dessus du seuil « bon » (${valeur} > ${seuil})`);
      }
    }
  }

  console.log("\nCache chaud, poste de bureau");
  for (const chemin of PAGES.slice(0, 3)) {
    const m = await mesurer(navigateur, chemin, { cacheChaud: true });
    if (m.erreur !== undefined) continue;
    const avant = froid.get(chemin);
    const gain = avant?.lcp > 0 ? Math.round(((avant.lcp - m.lcp) / avant.lcp) * 100) : 0;
    console.log(
      `  ${chemin.padEnd(16)} LCP ${String(m.lcp).padStart(5)}ms (${gain >= 0 ? "-" : "+"}${Math.abs(gain)} % vs cache froid)`,
    );
  }

  console.log("\nProfil mobile lent (4G bridee, processeur /4)");
  for (const chemin of PAGES.slice(0, 3)) {
    const m = await mesurer(navigateur, chemin, { mobile: true });
    if (m.erreur !== undefined) {
      console.log(`  ${chemin.padEnd(16)} ${m.erreur}`);
      continue;
    }
    console.log(
      `  ${chemin.padEnd(16)} TTFB ${String(m.ttfb).padStart(4)}ms  LCP ${String(m.lcp).padStart(5)}ms  CLS ${m.cls}`,
    );
    if (m.lcp > 4000) {
      alertes += 1;
      console.log(`      ! LCP mobile au-dela de 4 s (${m.lcp} ms)`);
    }
  }

  console.log("\nRessource la plus lourde, par page");
  for (const [chemin, m] of froid) {
    if (m.erreur !== undefined || m.plusLourde === null) continue;
    console.log(
      `  ${chemin.padEnd(16)} ${m.plusLourde.nom.padEnd(34)} ${Math.round(m.plusLourde.octets / 1024)} Ko`,
    );
  }

  console.log(
    "\n  (non mesure) INP : la metrique demande une interaction humaine reelle.\n" +
      "               Le delai de premiere interaction provoquee est indique ci-dessous,\n" +
      "               et ce n est pas la meme chose.",
  );
  for (const [chemin, m] of froid) {
    if (m.erreur !== undefined || m.interaction === null) continue;
    console.log(`  ${chemin.padEnd(16)} premiere interaction : ${m.interaction} ms`);
  }
} finally {
  await navigateur.close();
}

console.log("\n" + "-".repeat(72));
console.log(
  alertes === 0
    ? "Performance : toutes les pages mesurees restent dans les seuils « bon »."
    : `Performance : ${alertes} mesure(s) au-dela des seuils.`,
);
process.exitCode = 0;
