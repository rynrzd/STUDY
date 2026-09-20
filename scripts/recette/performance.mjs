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
          const resultat = { lcp: 0, cls: 0, fcp: 0, ttfb: 0, octets: 0, jsOctets: 0, requetes: 0, plusLourde: null };

          const navigation = performance.getEntriesByType("navigation")[0];
          if (navigation !== undefined) {
            resultat.ttfb = navigation.responseStart;
            resultat.octets += navigation.transferSize || navigation.encodedBodySize || 0;
            resultat.requetes += 1;
          }

          const peinture = performance.getEntriesByName("first-contentful-paint")[0];
          if (peinture !== undefined) resultat.fcp = peinture.startTime;

          // Le LCP ne se lit pas avec `getEntriesByType` : il n'est pas
          // conservé dans le tampon standard. Il faut l'observer en demandant
          // explicitement les entrées déjà survenues.
          try {
            new PerformanceObserver((liste) => {
              for (const entree of liste.getEntries()) {
                resultat.lcp = Math.max(resultat.lcp, entree.startTime);
              }
            }).observe({ type: "largest-contentful-paint", buffered: true });

            new PerformanceObserver((liste) => {
              for (const entree of liste.getEntries()) {
                if (!entree.hadRecentInput) resultat.cls += entree.value;
              }
            }).observe({ type: "layout-shift", buffered: true });
          } catch {
            /* métriques indisponibles sur ce navigateur */
          }

          // Les tailles viennent de l'API Resource Timing, pas de
          // `content-length` : cet en-tête est absent dès qu'une réponse est
          // compressée ou envoyée par morceaux, et l'on mesurait alors 1 Ko
          // pour toute une application.
          let maximum = { nom: "", octets: 0 };
          for (const entree of performance.getEntriesByType("resource")) {
            const octets = entree.transferSize || entree.encodedBodySize || 0;
            resultat.octets += octets;
            resultat.requetes += 1;
            if (entree.initiatorType === "script") resultat.jsOctets += octets;
            if (octets > maximum.octets) {
              maximum = { nom: entree.name.split("/").pop().slice(0, 32), octets };
            }
          }
          if (maximum.octets > 0) resultat.plusLourde = maximum;

          setTimeout(() => resoudre(resultat), 600);
        }),
    );

    // Le temps qu'il faut au navigateur pour répondre à un geste, mesuré dans
    // la page : on demande une image du prochain rendu après un clic sur un
    // élément réellement visible. Ce n'est **pas** l'INP — celui-ci se mesure
    // sur des personnes, pas sur un navigateur au repos — et le rapport ne le
    // présentera pas comme tel.
    const reponseAuGeste = await page.evaluate(
      () =>
        new Promise((resoudre) => {
          const candidats = [...document.querySelectorAll("a, button")].filter((element) => {
            const boite = element.getBoundingClientRect();
            return boite.width > 0 && boite.height > 0 && boite.top >= 0 && boite.top < window.innerHeight;
          });
          if (candidats.length === 0) return resoudre(null);

          const debutGeste = performance.now();
          candidats[0].dispatchEvent(new MouseEvent("pointerdown", { bubbles: true }));
          requestAnimationFrame(() =>
            requestAnimationFrame(() => resoudre(Math.round(performance.now() - debutGeste))),
          );
        }),
    );

    return {
      total: Date.now() - debut,
      ttfb: Math.round(vitals.ttfb),
      fcp: Math.round(vitals.fcp),
      lcp: Math.round(vitals.lcp),
      cls: Number(vitals.cls.toFixed(3)),
      interaction: reponseAuGeste,
      requetes: vitals.requetes,
      octets: vitals.octets,
      jsOctets: vitals.jsOctets,
      plusLourde: vitals.plusLourde,
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
  // Une navigation jetée avant de mesurer.
  //
  // La toute première requête d'un navigateur neuf paie la résolution DNS et
  // la poignée de main TLS : elle affichait 1,8 s de TTFB là où `curl` mesure
  // 0,15 s sur la même page. Sans ce préchauffage, la première page de la
  // liste porte le coût de toutes les autres, et le rapport accuse un écran
  // qui n'y est pour rien.
  await mesurer(navigateur, "/").catch(() => {});

  console.log("\nCache froid, poste de bureau");
  console.log("  (« froid » = cache navigateur vide ; la connexion, elle, est etablie)");
  console.log("  page              TTFB    FCP    LCP    CLS   requetes     JS    total");

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
    console.log(`  ${chemin.padEnd(16)} reponse au premier geste : ${m.interaction} ms`);
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
