#!/usr/bin/env node
// =============================================================================
// Recette responsive, clavier et hiérarchie — AvecStudy
//
//   npm run build && npm run start
//   npm run verifier:responsive
//
// `verifier-site.mjs` lit le balisage servi : il attrape les fautes qui se
// voient dans le HTML. Celui-ci ouvre un vrai navigateur et **mesure** — ce qui
// est la seule façon de répondre aux questions du cahier V5, §11 : la page
// déborde-t-elle à 375 pixels ? le titre est-il lisible sans zoomer ? la
// tabulation atteint-elle les liens, et le focus se voit-il ?
//
// Ce qu'il ne remplace toujours pas : un lecteur d'écran, et un œil humain sur
// une hiérarchie visuelle. Ces deux-là restent à faire à la main, et le script
// ne prétend pas le contraire.
// =============================================================================

import { chromium } from "playwright-core";
import { chargerEnv, titre } from "./_commun.mjs";

// Sans ceci, `SITE_BASE` n est pas lue et le script mesure
// `localhost:3100` — c est-a-dire, au mieux, un serveur local reste ouvert,
// et non le site deploye que l on croit verifier.
chargerEnv();

const BASE = (process.env.SITE_BASE ?? "http://localhost:3100").replace(/\/+$/, "");

/**
 * Les largeurs du cahier V5, §11.
 *
 * 375 est l'iPhone SE, encore très présent dans les classes ; 390 l'iPhone
 * courant ; 430 les grands modèles. 768 est la tablette en portrait, celle des
 * salles informatiques. Au-delà, les postes du lycée et les portables des
 * professeurs.
 */
const LARGEURS = [375, 390, 430, 768, 1024, 1280, 1440];

/** Les pages publiques, celles qu'un visiteur atteint sans compte. */
const PAGES = [
  "/",
  "/produit",
  "/etablissements",
  "/offre",
  "/securite",
  "/aide",
  "/contact",
  "/connexion",
  "/mentions-legales",
  "/confidentialite",
  "/conditions",
  "/accessibilite",
];

let echecs = 0;

function verifier(condition, libelle, detail = "") {
  if (condition) {
    console.log(`  ok   ${libelle}`);
    return true;
  }
  echecs += 1;
  console.log(`  ECHEC ${libelle}${detail ? ` — ${detail}` : ""}`);
  return false;
}

/**
 * Ouvre une page, et refuse de continuer si ce n'est pas la nôtre.
 *
 * Sans ce contrôle, une navigation ratée — réveil à froid de l'hébergeur,
 * coupure d'une seconde — laisse le navigateur afficher **sa propre** page
 * d'erreur, que le script mesure ensuite en croyant mesurer le site. Il en
 * ressort des défauts de conception imaginaires : « le H1 ne grandit pas »,
 * « les cibles tactiles sont trop petites ». Un outil de mesure qui ment coûte
 * plus cher que pas d'outil du tout.
 *
 * On réessaie deux fois avant d'abandonner : l'incident est passager par
 * nature, et échouer sur une seconde de réseau serait tout aussi trompeur.
 */
async function ouvrir(page, url, { essais = 3 } = {}) {
  let dernier = null;

  for (let essai = 1; essai <= essais; essai += 1) {
    try {
      const reponse = await page.goto(url, { waitUntil: "networkidle", timeout: 30_000 });
      const statut = reponse?.status() ?? 0;

      if (statut >= 200 && statut < 400) return reponse;
      dernier = `HTTP ${statut}`;
    } catch (erreur) {
      dernier = erreur.message.split("\n")[0];
    }
  }

  throw new Error(`${url} n a pas pu etre ouverte (${dernier}) — mesure abandonnee`);
}

/**
 * Mesure une page à une largeur donnée.
 *
 * On tolère un pixel : les navigateurs arrondissent les largeurs fractionnaires
 * et un écart de 0,5 px n'est pas un débordement. Au-delà, quelque chose
 * dépasse réellement, et l'utilisateur voit une barre horizontale.
 */
async function mesurer(page, adresse, largeur) {
  await page.setViewportSize({ width: largeur, height: 900 });
  await ouvrir(page, `${BASE}${adresse}`);

  return page.evaluate(() => {
    const racine = document.documentElement;

    // Le coupable, quand il y en a un : l'élément le plus à droite qui dépasse.
    let coupable = null;
    for (const element of document.body.querySelectorAll("*")) {
      const boite = element.getBoundingClientRect();
      if (boite.width === 0 && boite.height === 0) continue;
      if (boite.right <= window.innerWidth + 1) continue;

      // Un conteneur qui défile horizontalement a le droit de dépasser : c'est
      // exactement son travail, et le contenu reste atteignable.
      let parent = element.parentElement;
      let dansUnDefilement = false;
      while (parent !== null && parent !== document.body) {
        const style = getComputedStyle(parent);
        if (style.overflowX === "auto" || style.overflowX === "scroll") {
          dansUnDefilement = true;
          break;
        }
        parent = parent.parentElement;
      }
      if (dansUnDefilement) continue;

      const style = getComputedStyle(element);
      if (style.overflowX === "auto" || style.overflowX === "scroll") continue;

      coupable = {
        balise: element.tagName.toLowerCase(),
        classe: String(element.className ?? "").slice(0, 80),
        droite: Math.round(boite.right),
      };
      break;
    }

    const h1 = document.querySelector("h1");
    const styleH1 = h1 === null ? null : getComputedStyle(h1);

    return {
      scrollWidth: racine.scrollWidth,
      innerWidth: window.innerWidth,
      coupable,
      h1: h1 === null ? null : { taille: parseFloat(styleH1.fontSize), texte: h1.innerText.trim().slice(0, 40) },
      nombreH1: document.querySelectorAll("h1").length,
    };
  });
}

async function principal() {
  titre(`AvecStudy — recette responsive et clavier\n${BASE}`);

  // Le navigateur de recette : celui qui est installe sur la machine.
  // `playwright-core` ne telecharge rien ; il pilote Chrome, Edge ou un
  // Chromium deja present. Le canal est configurable, parce que la machine
  // d un integrateur n a pas forcement les memes.
  const canal = process.env.NAVIGATEUR_RECETTE ?? "msedge";
  const navigateur = await chromium.launch({ channel: canal });
  const contexte = await navigateur.newContext();
  const page = await contexte.newPage();

  try {
    console.log("Debordement horizontal, page par page et largeur par largeur");

    for (const adresse of PAGES) {
      const fautes = [];

      for (const largeur of LARGEURS) {
        const mesure = await mesurer(page, adresse, largeur);
        if (mesure.scrollWidth > mesure.innerWidth + 1) {
          const qui = mesure.coupable;
          fautes.push(
            `${largeur}px (${mesure.scrollWidth} > ${mesure.innerWidth}` +
              (qui ? `, ${qui.balise}.${qui.classe}` : "") +
              ")",
          );
        }
      }

      verifier(fautes.length === 0, `${adresse} ne deborde a aucune largeur`, fautes.join(" ; "));
    }

    console.log("\nLisibilite du titre sans zoomer (V5 §2.2)");

    const petit = await mesurer(page, "/", 390);
    verifier(petit.h1 !== null, "la page d accueil a un H1");
    verifier(petit.nombreH1 === 1, "un seul H1", `${petit.nombreH1} trouve(s)`);
    verifier(
      petit.h1 !== null && petit.h1.taille >= 28,
      "le H1 fait au moins 28 px a 390 px de large",
      petit.h1 === null ? "" : `${petit.h1.taille} px`,
    );

    const large = await mesurer(page, "/", 1440);
    verifier(
      large.h1 !== null && large.h1.taille > petit.h1.taille,
      "le H1 grandit sur grand ecran",
      large.h1 === null ? "" : `${large.h1.taille} px contre ${petit.h1?.taille} px`,
    );

    console.log("\nLes fragments du hero (V5 §2.4)");

    await page.setViewportSize({ width: 390, height: 844 });
    await ouvrir(page, `${BASE}/`);

    // La barre laterale de la fenetre d apercu : elle ne doit occuper aucune
    // surface sur telephone. Zero pixel, pas « petite ».
    const surfaceLaterale = await page.evaluate(() => {
      let total = 0;
      for (const element of document.querySelectorAll('[class*="w-[84px]"]')) {
        const boite = element.getBoundingClientRect();
        total += boite.width * boite.height;
      }
      return total;
    });
    verifier(
      surfaceLaterale === 0,
      "aucune barre laterale de bureau n est rendue a 390 px",
      `${Math.round(surfaceLaterale)} px carres`,
    );

    // `innerText` rend le texte **affiche** : une etiquette mise en
    // capitales par CSS ressort en capitales. La comparaison est donc
    // insensible a la casse, sans quoi le test echouerait sur une regle de
    // style plutot que sur un contenu absent.
    const fragmentsVus = await page.evaluate(() => {
      const textes = [...document.querySelectorAll("p")].map((p) =>
        p.innerText.trim().toLowerCase(),
      );
      return {
        aujourdhui: textes.some((t) => t.startsWith("aujourd")),
        aFaire: textes.some((t) => t === "à faire"),
      };
    });
    verifier(fragmentsVus.aujourdhui, "le fragment « Aujourd hui » est visible a 390 px");
    verifier(fragmentsVus.aFaire, "le fragment « A faire » est visible a 390 px");

    await page.setViewportSize({ width: 1440, height: 900 });
    await ouvrir(page, `${BASE}/`);
    const lateraleLarge = await page.evaluate(() => {
      const element = document.querySelector('[class*="w-[84px]"]');
      return element === null ? 0 : element.getBoundingClientRect().width;
    });
    verifier(lateraleLarge > 0, "la fenetre d apercu reprend sa place a 1440 px");

    console.log("\nCible tactile (V5 §11)");

    await page.setViewportSize({ width: 390, height: 844 });
    await ouvrir(page, `${BASE}/`);

    const tropPetits = await page.evaluate(() => {
      const trouves = [];
      for (const element of document.querySelectorAll("a, button")) {
        const boite = element.getBoundingClientRect();
        if (boite.width === 0 || boite.height === 0) continue;

        // Un lien au fil du texte suit la ligne : ce n'est pas une cible
        // tactile isolee, et lui imposer 44 px casserait le paragraphe.
        const parent = element.parentElement;
        const dansUnParagraphe =
          parent !== null && ["P", "LI", "SPAN"].includes(parent.tagName) &&
          parent.innerText.trim().length > element.innerText.trim().length + 10;
        if (dansUnParagraphe) continue;

        if (boite.height < 40) {
          trouves.push(`${element.tagName.toLowerCase()} « ${element.innerText.trim().slice(0, 24)} » ${Math.round(boite.height)} px`);
        }
      }
      return trouves;
    });
    verifier(
      tropPetits.length === 0,
      "toutes les cibles isolees font au moins 40 px de haut",
      tropPetits.slice(0, 4).join(" ; "),
    );

    console.log("\nNavigation au clavier (V5 §11)");

    await ouvrir(page, `${BASE}/`);
    await page.keyboard.press("Tab");

    const premier = await page.evaluate(() => {
      const actif = document.activeElement;
      if (actif === null) return null;
      const style = getComputedStyle(actif);
      return {
        balise: actif.tagName.toLowerCase(),
        texte: actif.innerText?.trim().slice(0, 40) ?? "",
        href: actif.getAttribute("href") ?? "",
        contour: style.outlineStyle !== "none" && parseFloat(style.outlineWidth) > 0,
        ombre: style.boxShadow !== "none",
      };
    });

    verifier(premier !== null, "la tabulation atteint un element");
    verifier(
      premier !== null && /#/.test(premier.href),
      "le premier arret est le lien d evitement",
      premier === null ? "" : `${premier.balise} « ${premier.texte} »`,
    );
    verifier(
      premier !== null && (premier.contour || premier.ombre),
      "le focus se voit",
      premier === null ? "" : "ni contour ni ombre",
    );

    // On traverse toute la page : chaque arret doit rester visible a l ecran
    // et montrer son focus. Un piege a clavier se verrait ici - la tabulation
    // reviendrait indefiniment sur le meme element.
    const parcours = await page.evaluate(async () => {
      const vus = new Set();
      let sansContour = 0;
      let arrets = 0;

      for (let i = 0; i < 60; i += 1) {
        const actif = document.activeElement;
        if (actif === null || actif === document.body) break;

        arrets += 1;
        const cle = `${actif.tagName}:${actif.getAttribute("href") ?? ""}:${actif.innerText?.slice(0, 20) ?? ""}`;
        vus.add(cle);

        const style = getComputedStyle(actif);
        const visible =
          (style.outlineStyle !== "none" && parseFloat(style.outlineWidth) > 0) ||
          style.boxShadow !== "none";
        if (!visible) sansContour += 1;

        // Pas de simulation de Tab possible depuis la page : on s arrete ici
        // et le pilote continue au-dehors.
        break;
      }

      return { arrets, distincts: vus.size, sansContour };
    });
    void parcours;

    let sansFocusVisible = 0;
    let arretsDistincts = new Set();

    for (let i = 0; i < 40; i += 1) {
      await page.keyboard.press("Tab");
      const arret = await page.evaluate(() => {
        const actif = document.activeElement;
        if (actif === null || actif === document.body) return null;
        const style = getComputedStyle(actif);
        const boite = actif.getBoundingClientRect();
        return {
          cle: `${actif.tagName}:${actif.getAttribute("href") ?? ""}:${(actif.innerText ?? "").slice(0, 24)}`,
          visible:
            (style.outlineStyle !== "none" && parseFloat(style.outlineWidth) > 0) ||
            style.boxShadow !== "none",
          dansLEcran: boite.width > 0 && boite.height > 0,
        };
      });

      if (arret === null) break;
      arretsDistincts.add(arret.cle);
      if (!arret.visible && arret.dansLEcran) sansFocusVisible += 1;
    }

    verifier(
      arretsDistincts.size >= 8,
      "la tabulation traverse la page",
      `${arretsDistincts.size} arret(s) distinct(s)`,
    );
    verifier(
      sansFocusVisible === 0,
      "chaque arret montre son focus",
      `${sansFocusVisible} sans contour ni ombre`,
    );

    console.log("\nMouvement reduit (V5 §11)");

    const contexteCalme = await navigateur.newContext({ reducedMotion: "reduce" });
    const pageCalme = await contexteCalme.newPage();
    await pageCalme.setViewportSize({ width: 390, height: 844 });
    await pageCalme.goto(`${BASE}/`, { waitUntil: "networkidle" });

    const contenuVisible = await pageCalme.evaluate(() => {
      // Le piege classique des animations a l apparition : le contenu reste a
      // opacite zero quand l animation ne se declenche pas.
      const caches = [];
      for (const element of document.querySelectorAll("section, h2")) {
        const style = getComputedStyle(element);
        if (parseFloat(style.opacity) < 0.1) {
          caches.push(element.tagName.toLowerCase() + "." + String(element.className).slice(0, 40));
        }
      }
      return caches;
    });
    verifier(
      contenuVisible.length === 0,
      "aucun contenu ne reste invisible sans animation",
      contenuVisible.slice(0, 3).join(" ; "),
    );

    await contexteCalme.close();
  } finally {
    await navigateur.close();
  }

  console.log("\n" + "-".repeat(72));
  if (echecs === 0) {
    console.log("Aucun defaut mesure.");
    console.log("Restent a faire a la main : lecteur d ecran, et hierarchie visuelle.");
    process.exitCode = 0;
    return;
  }
  console.log(`${echecs} defaut(s) mesure(s).`);
  process.exitCode = 1;
}

await principal();
