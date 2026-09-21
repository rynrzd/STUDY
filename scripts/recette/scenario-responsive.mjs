// =============================================================================
// §8 — Responsive connecté et accessibilité.
//
// Les vérifications publiques ne voient que la vitrine. Or ce sont les écrans
// **connectés** qui portent les tableaux, les longues listes et les formulaires
// — c'est-à-dire tout ce qui déborde. Un élève consulte son cours sur un
// téléphone, un administrateur vérifie un import sur le poste du secrétariat :
// les deux doivent tenir.
//
// Chaque mesure vérifie d'abord **où elle a lieu** : l'origine exacte, et un
// marqueur propre à la page attendue. Sans cela, une redirection silencieuse
// vers la connexion se mesurerait comme un écran parfaitement responsive — ce
// qu'elle est, et qui ne prouve rien.
//
// Ce que ce fichier n'automatise pas, et le dit : un lecteur d'écran, et le
// jugement sur une hiérarchie visuelle. Aucun script ne les remplace.
// =============================================================================

import { connecter, contexteDe, verifierEcran } from "./navigateur.mjs";

/** Les largeurs du cahier, des plus petits téléphones aux postes de bureau. */
const TAILLES = [
  [320, 568],
  [360, 800],
  [390, 844],
  [430, 932],
  [768, 1024],
  [1024, 768],
  [1280, 800],
  [1440, 900],
];

/** Ce qu'on mesure sur une page, une fois qu'on est sûr d'être dessus. */
async function mesurer(page) {
  return page.evaluate(() => {
    const racine = document.documentElement;
    const largeur = window.innerWidth;

    /** Le premier élément qui dépasse, hors conteneurs prévus pour défiler. */
    let debordant = null;
    for (const element of document.body.querySelectorAll("*")) {
      const boite = element.getBoundingClientRect();
      if (boite.width === 0 && boite.height === 0) continue;
      if (boite.right <= largeur + 1) continue;

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

      const propre = getComputedStyle(element);
      if (propre.overflowX === "auto" || propre.overflowX === "scroll") continue;

      debordant = `${element.tagName.toLowerCase()}.${String(element.className ?? "").slice(0, 50)}`;
      break;
    }

    /**
     * Un élément n'est-il visible qu'une fois atteint au clavier ?
     *
     * Le lien d'évitement est posé hors écran et ne revient qu'au focus.
     * Le compter comme « bouton hors écran » ou comme cible tactile trop
     * petite signalerait un défaut là où il y a une bonne pratique — et une
     * alerte qui se trompe finit par être ignorée.
     */
    const cacheJusquAuFocus = (element) => {
      const style = getComputedStyle(element);
      const boite = element.getBoundingClientRect();
      if (style.clip === "rect(0px, 0px, 0px, 0px)") return true;
      if (Number(style.opacity) === 0) return true;
      if (boite.right < 0 || boite.bottom < 0) return true;
      if (style.position === "absolute" && boite.left < 0) return true;
      return false;
    };

    /** Les cibles tactiles trop petites, hors liens au fil du texte. */
    const cibles = [];
    for (const element of document.querySelectorAll("a, button, input[type=checkbox], select")) {
      const boite = element.getBoundingClientRect();
      if (boite.width === 0 || boite.height === 0) continue;
      if (cacheJusquAuFocus(element)) continue;

      const parent = element.parentElement;
      const auFilDuTexte =
        parent !== null &&
        ["P", "LI", "SPAN"].includes(parent.tagName) &&
        (parent.innerText ?? "").trim().length > (element.textContent ?? "").trim().length + 10;
      if (auFilDuTexte) continue;

      if (boite.height < 40) {
        cibles.push(`${element.tagName.toLowerCase()} « ${(element.textContent ?? "").trim().slice(0, 20)} » ${Math.round(boite.height)}px`);
      }
    }

    /** L'élément est-il dans un conteneur prévu pour défiler ? */
    const dansUnDefilement = (element) => {
      let parent = element.parentElement;
      while (parent !== null && parent !== document.body) {
        const style = getComputedStyle(parent);
        if (style.overflowX === "auto" || style.overflowX === "scroll") return true;
        parent = parent.parentElement;
      }
      return false;
    };

    /**
     * Un élément interactif hors de l'écran, et hors d'atteinte.
     *
     * La barre de navigation défile horizontalement : un onglet qui dépasse y
     * reste parfaitement atteignable, et le signaler comme « hors écran »
     * accusait une bonne pratique. Seul ce qui dépasse **sans** pouvoir être
     * ramené compte.
     */
    const horsEcran = [];
    for (const element of document.querySelectorAll("a, button")) {
      const boite = element.getBoundingClientRect();
      if (boite.width === 0 || boite.height === 0) continue;
      if (cacheJusquAuFocus(element)) continue;
      if (dansUnDefilement(element)) continue;
      if (boite.left < -1 || boite.right > largeur + 1) {
        horsEcran.push((element.textContent ?? "").trim().slice(0, 24));
      }
    }

    /** Un tableau doit soit tenir, soit pouvoir défiler. */
    const tableauxCoinces = [];
    for (const tableau of document.querySelectorAll("table")) {
      if (tableau.scrollWidth <= largeur + 1) continue;
      let parent = tableau.parentElement;
      let defile = false;
      while (parent !== null && parent !== document.body) {
        const style = getComputedStyle(parent);
        if (style.overflowX === "auto" || style.overflowX === "scroll") {
          defile = true;
          break;
        }
        parent = parent.parentElement;
      }
      if (!defile) tableauxCoinces.push(tableau.className.slice(0, 40) || "table");
    }

    /** Un champ sans intitulé accessible ne se comprend pas au lecteur d'écran. */
    const champsMuets = [];
    for (const champ of document.querySelectorAll("input, select, textarea")) {
      if (champ.type === "hidden") continue;
      const etiquete =
        champ.labels?.length > 0 ||
        champ.getAttribute("aria-label") !== null ||
        champ.getAttribute("aria-labelledby") !== null ||
        champ.getAttribute("title") !== null;
      if (!etiquete) champsMuets.push(champ.name || champ.id || champ.type);
    }

    return {
      scrollWidth: racine.scrollWidth,
      innerWidth: largeur,
      debordant,
      cibles,
      horsEcran,
      tableauxCoinces,
      champsMuets,
    };
  });
}

/**
 * Ouvre une page connectée et **prouve** qu'on est dessus avant de mesurer.
 *
 * Rend `null` si la page n'a pas pu être atteinte : l'appelant le signale
 * plutôt que de mesurer autre chose.
 */
async function ouvrir(page, base, chemin, marqueur) {
  const reponse = await page.goto(`${base}${chemin}`, { waitUntil: "networkidle", timeout: 30_000 }).catch(() => null);
  if (reponse === null || reponse.status() >= 400) return `HTTP ${reponse?.status() ?? "injoignable"}`;

  const probleme = await verifierEcran(page, base, { attendu: chemin, marqueur });
  return probleme;
}

export async function scenarioResponsive({ navigateur, base, terrain, verifier }) {
  console.log("\n§8. Responsive connecte et accessibilite");

  // Un marqueur par espace : la présence du cadre applicatif prouve qu'on est
  // bien dans l'espace, et pas sur l'écran de connexion.
  const espaces = [
    {
      cle: "administrateur",
      identite: {
        code: terrain.code,
        login: terrain.administrateur.login,
        motDePasse: terrain.administrateur.motDePasse,
        secretTotp: terrain.administrateur.secretTotp,
      },
      pages: [
        ["/admin", "main"],
        ["/admin/classes", "main"],
        ["/admin/import", '[data-testid="depot-rentree"]'],
        ["/admin/utilisateurs", "main"],
        ["/admin/professeurs", "main"],
      ],
    },
    {
      cle: "professeur",
      identite: {
        code: terrain.code,
        login: terrain.comptes.professeur.login,
        motDePasse: terrain.comptes.professeur.motDePasse ?? terrain.comptes.professeur.motDePasseTemporaire,
      },
      pages: [
        ["/professeur", "main"],
        ["/professeur/classes", "main"],
        ["/professeur/devoirs", "main"],
        ["/studio", '[data-testid="chapitre-nouveau"]'],
      ],
    },
    {
      cle: "eleve",
      identite: {
        code: terrain.code,
        login: terrain.comptes.eleveA.login,
        motDePasse: terrain.comptes.eleveA.motDePasse ?? terrain.comptes.eleveA.motDePasseTemporaire,
      },
      pages: [
        ["/eleve", "main"],
        ["/eleve/cours", "main"],
        ["/eleve/devoirs", "main"],
        ["/eleve/entraide", "main"],
        ["/parametres", "main"],
      ],
    },
  ];

  for (const espace of espaces) {
    const { contexte, page } = await contexteDe(navigateur);

    try {
      await connecter(page, base, espace.identite);

      for (const [chemin, marqueur] of espace.pages) {
        const fautes = [];
        let injoignable = null;

        for (const [largeur, hauteur] of TAILLES) {
          await page.setViewportSize({ width: largeur, height: hauteur });
          const probleme = await ouvrir(page, base, chemin, marqueur);

          if (probleme !== null) {
            injoignable = probleme;
            break;
          }

          const mesure = await mesurer(page);

          if (mesure.scrollWidth > mesure.innerWidth + 1) {
            fautes.push(`${largeur}px deborde (${mesure.debordant ?? "?"})`);
          }
          if (mesure.horsEcran.length > 0) {
            fautes.push(`${largeur}px : bouton hors ecran (${mesure.horsEcran[0]})`);
          }
          if (mesure.tableauxCoinces.length > 0) {
            fautes.push(`${largeur}px : tableau sans defilement`);
          }
          if (largeur <= 430 && mesure.cibles.length > 0) {
            fautes.push(`${largeur}px : cible trop petite (${mesure.cibles[0]})`);
          }
          if (mesure.champsMuets.length > 0) {
            fautes.push(`champ sans intitule (${mesure.champsMuets[0]})`);
          }
        }

        if (injoignable !== null) {
          verifier(false, `${espace.cle} ${chemin} : page atteinte`, injoignable);
          continue;
        }

        verifier(
          fautes.length === 0,
          `${espace.cle} ${chemin} : tient a huit largeurs`,
          fautes.slice(0, 2).join(" ; "),
        );
      }

      /* --- Clavier, focus, zoom : une fois par espace ---------------------- */

      const [premierChemin, premierMarqueur] = espace.pages[0];
      await page.setViewportSize({ width: 1280, height: 800 });
      const accessible = await ouvrir(page, base, premierChemin, premierMarqueur);

      if (accessible !== null) {
        verifier(false, `${espace.cle} : ecran de reference atteint`, accessible);
        continue;
      }

      // La tabulation atteint quelque chose, et ce quelque chose se voit.
      await page.keyboard.press("Tab");
      const focusVisible = await page.evaluate(() => {
        const actif = document.activeElement;
        if (actif === null || actif === document.body) return null;
        const style = getComputedStyle(actif);
        const visible =
          style.outlineStyle !== "none" ||
          style.boxShadow !== "none" ||
          style.borderColor !== "rgba(0, 0, 0, 0)";
        return { balise: actif.tagName.toLowerCase(), visible };
      });
      verifier(
        focusVisible !== null && focusVisible.visible,
        `${espace.cle} : la tabulation atteint un element et son focus se voit`,
        JSON.stringify(focusVisible),
      );

      // Zoom 200 % : on l'obtient en divisant la largeur par deux, ce que fait
      // un navigateur qui agrandit tout d'un facteur deux.
      await page.setViewportSize({ width: 640, height: 512 });
      await page.reload({ waitUntil: "networkidle" }).catch(() => {});
      const zoom = await mesurer(page);
      verifier(
        zoom.scrollWidth <= zoom.innerWidth + 1,
        `${espace.cle} : lisible a 200 % de zoom, sans defilement horizontal`,
        `${zoom.scrollWidth} > ${zoom.innerWidth} (${zoom.debordant ?? "?"})`,
      );

      // Mouvement réduit : rien ne doit rester invisible faute d'animation.
      const contexteCalme = await navigateur.newContext({
        viewport: { width: 1280, height: 800 },
        reducedMotion: "reduce",
        storageState: await contexte.storageState(),
      });
      const pageCalme = await contexteCalme.newPage();
      try {
        const souci = await ouvrir(pageCalme, base, premierChemin, premierMarqueur);
        if (souci === null) {
          const invisible = await pageCalme.evaluate(() => {
            let caches = 0;
            for (const element of document.querySelectorAll("main *")) {
              const style = getComputedStyle(element);
              if (Number(style.opacity) === 0 && (element.textContent ?? "").trim() !== "") caches += 1;
            }
            return caches;
          });
          verifier(
            invisible === 0,
            `${espace.cle} : sans animation, aucun contenu ne reste invisible`,
            `${invisible} element(s)`,
          );
        } else {
          verifier(false, `${espace.cle} : ecran lisible en mouvement reduit`, souci);
        }
      } finally {
        await contexteCalme.close();
      }
    } catch (erreur) {
      verifier(false, `${espace.cle} : espace parcouru`, erreur.message.split("\n")[0]);
    } finally {
      await contexte.close();
    }
  }

  console.log(
    "  (non automatise) lecteur d ecran et jugement sur la hierarchie visuelle :\n" +
      "                   aucun script ne les remplace, ils restent a faire a la main.",
  );
}
