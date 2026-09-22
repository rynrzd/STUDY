#!/usr/bin/env node
// =============================================================================
// La revue : ce qui se voit, et ce qui s'entend.
//
//   npm run revue -- --sortie <dossier> [--terrain]
//
// Deux choses, et elles sont différentes.
//
//   **Ce qui se voit.** Chaque page est capturée en pleine hauteur, à deux
//   largeurs : 390 pixels — le téléphone courant d'un élève — et 1280 — le
//   poste d'un professeur. Les images sont écrites sur disque pour être
//   regardées une par une. Aucun script ne juge une mise en page ; c'est un
//   œil qui le fait, et cette commande ne fait que lui fournir la matière.
//
//   **Ce qui s'entend.** L'arbre d'accessibilité, parcouru par
//   `sonde-lecteur-ecran.mjs`. Il dit ce qu'un lecteur d'écran a pour matière :
//   des rôles, des noms, un plan de titres, des points de repère.
//
// Ce que cette commande **ne fait pas**, et ne prétend pas faire : écouter.
// Un arbre correct peut produire une lecture pénible — un ordre déroutant, une
// verbosité inutile, une annonce qui arrive trop tard. Une session avec NVDA
// ou VoiceOver reste à faire par une personne, et rien ici ne la remplace.
//
// `--terrain` monte un établissement jetable pour revoir les trois espaces
// fermés, puis le démonte — même si la revue échoue en route.
// =============================================================================

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { createClient } from "@supabase/supabase-js";
import pg from "pg";
import { chromium } from "playwright-core";
import { chargerEnv, titre } from "../_commun.mjs";
import { balayer } from "./nettoyage.mjs";
import { connecter, contexteDe, exigerPage } from "./navigateur.mjs";
import { sondeLecteurEcran } from "./sonde-lecteur-ecran.mjs";
import { marqueurUnique, preparerTerrain } from "./terrain.mjs";

chargerEnv();

const BASE = (process.env.SITE_BASE ?? "http://localhost:3100").replace(/\/+$/, "");
const NAVIGATEUR = process.env.NAVIGATEUR_RECETTE ?? "msedge";
const AVEC_TERRAIN = process.argv.includes("--terrain");

const indexSortie = process.argv.indexOf("--sortie");
const SORTIE =
  indexSortie >= 0 && process.argv[indexSortie + 1] !== undefined
    ? process.argv[indexSortie + 1]
    : path.join(process.cwd(), "revue");

/** Les deux largeurs qui comptent : le téléphone d'un élève, le poste d'un professeur. */
const LARGEURS = [
  ["telephone", 390, 844],
  ["bureau", 1280, 900],
];

const PUBLIQUES = [
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

/**
 * Les trois espaces, par un parcours réel.
 *
 * Une revue qui ne regarderait que les accueils manquerait précisément les
 * écrans où le contenu s'accumule — une liste de classe, un suivi de remises.
 */
const ESPACES = [
  ["eleveA", "/eleve"],
  ["eleveA", "/eleve/devoirs"],
  ["eleveA", "/eleve/cours"],
  ["professeur", "/professeur"],
  ["professeur", "/professeur/devoirs"],
  ["professeur", "/professeur/classes"],
  ["professeur", "/professeur/studio"],
  ["administrateur", "/admin"],
  ["administrateur", "/admin/classes"],
  ["administrateur", "/admin/utilisateurs"],
  ["administrateur", "/admin/moderation"],
];

const releves = [];

/** Une page, capturée et auscultée, à chaque largeur. */
async function revoir(contexte, adresse, etiquette, ouvrir) {
  for (const [nom, largeur, hauteur] of LARGEURS) {
    const vue = await contexte.newPage();
    await vue.setViewportSize({ width: largeur, height: hauteur });

    try {
      await ouvrir(vue, adresse);

      const morceau = adresse.replace(/[^a-z0-9]+/gi, "-").replace(/^-|-$/g, "") || "accueil";
      const fichier = path.join(SORTIE, `${etiquette}--${morceau}--${nom}.png`);
      await vue.screenshot({ path: fichier, fullPage: true });

      const audition = await vue.evaluate(sondeLecteurEcran);
      releves.push({ page: adresse, largeur: nom, etiquette, fichier, ...audition });

      const etat = audition.fautes.length === 0 ? "ok  " : "NON ";
      console.log(
        `  ${etat} ${etiquette.padEnd(15)} ${adresse.padEnd(24)} ${nom.padEnd(10)}` +
          ` ${audition.compte.interactifs} manipulable(s)` +
          (audition.fautes.length === 0 ? "" : ` — ${audition.fautes.length} releve(s)`),
      );
    } catch (erreur) {
      releves.push({
        page: adresse,
        largeur: nom,
        etiquette,
        fautes: [{ genre: "acces", ou: adresse, detail: erreur.message.split("\n")[0] }],
        compte: { interactifs: 0, titres: 0, champs: 0, images: 0 },
      });
      console.log(`  NON  ${etiquette.padEnd(15)} ${adresse.padEnd(24)} ${nom.padEnd(10)} injoignable`);
    } finally {
      await vue.close().catch(() => {});
    }
  }
}

const sql = new pg.Client({
  connectionString: process.env.WORKER_DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  application_name: "revue-visuelle",
});

function service() {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
    db: { schema: "study" },
  });
}

/**
 * Un établissement de recette, avec ses comptes et l'administrateur activé.
 *
 * L'activation passe par l'interface : c'est le seul moment où un
 * administrateur traverse l'activation **et** l'enrôlement du second facteur.
 * La clé TOTP ne quitte pas la mémoire.
 */
async function monterLeTerrain(navigateur) {
  const etablissement = await import("../../src/lib/etablissement.ts");

  const { rows: exploitants } = await sql.query(
    "select profile_id from study_prive.editor_staff where state = 'active' limit 1",
  );
  if (exploitants.length === 0) throw new Error("aucun exploitant actif");

  const bati = await preparerTerrain({
    service: service(),
    exploitant: exploitants[0].profile_id,
    marqueur: marqueurUnique(),
    lib: {
      assurerAnnee: etablissement.assurerAnnee,
      creerClasse: etablissement.creerClasse,
      creerMatiere: etablissement.creerMatiere,
      creerCompte: etablissement.creerCompte,
      affecterProfesseur: etablissement.affecterProfesseur,
    },
    activerAdministrateur: async (identite) => {
      const { contexte, page } = await contexteDe(navigateur);
      try {
        return await connecter(page, BASE, identite);
      } finally {
        await contexte.close().catch(() => {});
      }
    },
  });

  // L'administrateur a sa propre entrée : il porte une clé TOTP que les autres
  // comptes n'ont pas.
  bati.comptes.administrateur = {
    login: bati.administrateur.login,
    motDePasse: bati.administrateur.motDePasse,
    secretTotp: bati.administrateur.secretTotp,
  };

  console.log(`  terrain ${bati.code} monte.`);
  return bati;
}

/* -------------------------------------------------------------------------- */

titre("AvecStudy — revue visuelle et lecteur d ecran");
console.log(`cible : ${BASE}`);
console.log(`captures : ${SORTIE}`);

await mkdir(SORTIE, { recursive: true });
if (AVEC_TERRAIN) await sql.connect();

const navigateur = await chromium.launch({ channel: NAVIGATEUR, headless: true });

try {
  /* --- Les pages publiques ------------------------------------------------ */

  console.log("\nPages publiques");

  // `reducedMotion` : les blocs qui apparaissent au défilement resteraient
  // sinon invisibles sur la capture, et absents de l'arbre.
  const publique = await navigateur.newContext({ reducedMotion: "reduce" });
  try {
    for (const adresse of PUBLIQUES) {
      await revoir(publique, adresse, "public", async (vue, cible) => {
        await vue.goto(`${BASE}${cible}`, { waitUntil: "networkidle" });
      });
    }
  } finally {
    await publique.close().catch(() => {});
  }

  /* --- Les trois espaces --------------------------------------------------- */

  console.log("\nEspaces connectes");

  if (!AVEC_TERRAIN) {
    console.log("  (non joue) relancer avec --terrain pour monter un etablissement jetable");
  } else {
    const terrain = await monterLeTerrain(navigateur);

    for (const cle of ["eleveA", "professeur", "administrateur"]) {
      const compte = terrain.comptes[cle];
      if (compte === undefined) continue;

      // Un contexte par rôle : les cookies sont partagés dans un contexte, et
      // une seconde connexion y écraserait la première.
      const contexte = await navigateur.newContext({ reducedMotion: "reduce" });
      try {
        const session = await contexte.newPage();
        await connecter(session, BASE, {
          code: terrain.code,
          login: compte.login,
          motDePasse: compte.motDePasse ?? compte.motDePasseTemporaire,
          secretTotp: compte.secretTotp ?? null,
        });
        await session.close().catch(() => {});

        for (const [role, adresse] of ESPACES.filter(([r]) => r === cle)) {
          await revoir(contexte, adresse, role, async (vue, cible) => {
            await exigerPage(vue, BASE, cible, {});
          });
        }
      } catch (erreur) {
        console.log(`  NON  ${cle.padEnd(15)} connexion impossible — ${erreur.message.split("\n")[0]}`);
      } finally {
        await contexte.close().catch(() => {});
      }
    }
  }
} finally {
  await navigateur.close().catch(() => {});

  // Le démontage passe quoi qu'il arrive : une revue interrompue ne doit pas
  // laisser un établissement derrière elle.
  if (AVEC_TERRAIN) {
    try {
      const bilan = await balayer(sql, service(), { trace: (l) => console.log(l) });
      console.log(
        `\n  terrain demonte : ${bilan.etablissements} etablissement(s), ${bilan.profils} compte(s).`,
      );
    } catch (erreur) {
      console.log(`\n  CRITIQUE : le demontage a echoue — ${erreur.message}`);
      process.exitCode = 1;
    } finally {
      await sql.end().catch(() => {});
    }
  }
}

/* --- Le relevé ------------------------------------------------------------- */

await writeFile(path.join(SORTIE, "releve.json"), JSON.stringify(releves, null, 2), "utf8");

const toutes = releves.flatMap((r) =>
  r.fautes.map((f) => ({ ...f, page: r.page, etiquette: r.etiquette })),
);

// Une même faute se répète à chaque largeur : on la dit une fois.
const uniques = new Map();
for (const faute of toutes) {
  const cle = `${faute.etiquette}|${faute.page}|${faute.genre}|${faute.ou}|${faute.detail}`;
  if (!uniques.has(cle)) uniques.set(cle, faute);
}

console.log("\n" + "-".repeat(72));
if (uniques.size === 0) {
  console.log(`Arbre d accessibilite : rien de muet sur ${releves.length / 2} page(s).`);
} else {
  console.log(`Arbre d accessibilite : ${uniques.size} releve(s).\n`);
  const parGenre = new Map();
  for (const faute of uniques.values()) {
    if (!parGenre.has(faute.genre)) parGenre.set(faute.genre, []);
    parGenre.get(faute.genre).push(faute);
  }
  for (const [genre, liste] of parGenre) {
    console.log(`  ${genre} (${liste.length})`);
    for (const faute of liste.slice(0, 14)) {
      console.log(`    ${faute.page.padEnd(24)} ${faute.ou.padEnd(32)} ${faute.detail}`);
    }
    if (liste.length > 14) console.log(`    (+${liste.length - 14} autre(s))`);
  }
}

console.log(
  "\nL ecoute reelle — NVDA, VoiceOver — reste a faire par une personne." +
    "\nCe releve dit qu il n y a rien de muet ; il ne dit pas que c est agreable a entendre.",
);

if (uniques.size > 0) process.exitCode = 1;
