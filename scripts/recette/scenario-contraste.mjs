// =============================================================================
// CONTRASTE_01 — le contraste des écrans connectés.
//
// `verifier:contraste` mesure les pages publiques : elles s'atteignent sans
// compte. Or ce sont les écrans **fermés** qui portent les badges d'état, les
// compteurs, les tableaux de suivi et les messages d'erreur — c'est-à-dire
// presque toutes les couleurs que le produit utilise pour dire quelque chose.
//
// Les mesurer suppose un terrain, et le terrain n'existe que le temps d'une
// recette connectée. C'est donc ici, avec les comptes jetables, et nulle part
// ailleurs.
// =============================================================================

import { connecter, exigerPage } from "./navigateur.mjs";
import { sondeContraste } from "./sonde-contraste.mjs";

/** Les écrans connectés qui portent des couleurs porteuses de sens. */
const ECRANS = [
  ["eleveA", "/eleve"],
  ["eleveA", "/eleve/devoirs"],
  ["eleveA", "/eleve/cours"],
  ["professeur", "/professeur/devoirs"],
  ["professeur", "/professeur/classes"],
];

/**
 * Le plancher au-dessous duquel « aucun échec » ne rassure pas.
 *
 * Une page qui n'offre presque rien à mesurer n'a pas été rendue : c'est ainsi
 * qu'on s'est aperçu qu'un serveur périmé servait une coquille. Mieux vaut un
 * échec franc qu'un calme trompeur.
 */
const PLANCHER = 10;

export async function scenarioContraste({ navigateur, base, terrain, verifier }) {
  console.log("\nCONTRASTE_01. Contraste des ecrans connectes");

  // `reducedMotion` : les blocs qui apparaissent au défilement restent sinon à
  // `opacity: 0`, et un élément transparent est exclu de la mesure — à juste
  // titre. Le composant respecte ce réglage et ne masque plus rien.
  const contexte = await navigateur.newContext({
    viewport: { width: 1280, height: 900 },
    reducedMotion: "reduce",
  });

  const vues = new Map();

  try {
    for (const cle of ["eleveA", "professeur"]) {
      const page = await contexte.newPage();
      const compte = terrain.comptes[cle];
      const session = await connecter(page, base, {
        code: terrain.code,
        login: compte.login,
        motDePasse: compte.motDePasse ?? compte.motDePasseTemporaire,
      });
      compte.motDePasse = session.motDePasse;
      vues.set(cle, page);
    }

    let echecs = 0;
    let mesures = 0;

    for (const [cle, adresse] of ECRANS) {
      const page = vues.get(cle);
      await exigerPage(page, base, adresse, {});

      const resultat = await page.evaluate(sondeContraste);
      mesures += resultat.mesures;

      if (resultat.mesures < PLANCHER) {
        echecs += 1;
        verifier(
          false,
          `CONTRASTE_01 — ${adresse} n a pas ete rendu en entier`,
          `${resultat.mesures} element(s)`,
        );
        continue;
      }

      if (resultat.fautes.length === 0) {
        verifier(true, `CONTRASTE_01 — ${adresse}`, `${resultat.mesures} element(s) mesure(s)`);
        continue;
      }

      echecs += resultat.fautes.length;
      for (const faute of resultat.fautes.slice(0, 5)) {
        verifier(
          false,
          `CONTRASTE_01 — ${adresse} : ${faute.mesure}:1 < ${faute.exige}:1`,
          `${faute.genre} ${faute.ou} — ${faute.avant} sur ${faute.arriere}` +
            (faute.extrait ? ` « ${faute.extrait} »` : ""),
        );
      }
      if (resultat.fautes.length > 5) {
        console.log(`       (+${resultat.fautes.length - 5} autre(s) sur ${adresse})`);
      }
    }

    verifier(
      echecs === 0,
      "CONTRASTE_01 — les ecrans connectes tiennent WCAG 2.2 AA",
      `${mesures} element(s) mesure(s), ${echecs} echec(s)`,
    );
  } finally {
    await contexte.close().catch(() => {});
  }
}
