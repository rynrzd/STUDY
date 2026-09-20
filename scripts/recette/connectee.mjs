#!/usr/bin/env node
// =============================================================================
// La recette connectée — `npm run recette:connectee`
//
// Elle joue, dans un vrai navigateur et contre le site déployé, ce qu'aucune
// vérification de balisage ne peut atteindre : le Studio, les devoirs, les
// remises, l'entraide, la case « fait », les fichiers.
//
// Elle bâtit son propre terrain — un lycée, deux classes, un professeur, trois
// élèves — l'utilise, puis le démonte. Le nettoyage est dans un `finally` : une
// interruption au milieu d'un scénario ne doit pas laisser des comptes en
// production.
//
// Aucun mot de passe, aucune clé TOTP, aucune URL signée n'est affichée ni
// écrite. Les identités vivent en mémoire le temps du processus.
// =============================================================================

import pg from "pg";
import { createClient } from "@supabase/supabase-js";
import { chargerEnv, titre } from "../_commun.mjs";
import { connecter, contexteDe, ouvrirNavigateur } from "./navigateur.mjs";
import { balayer, residuDeRecette } from "./nettoyage.mjs";
import { marqueurUnique, preparerTerrain } from "./terrain.mjs";
import { scenarioStudio } from "./scenario-studio.mjs";
import { scenarioClasse } from "./scenario-classe.mjs";

chargerEnv();

const BASE = (process.env.SITE_BASE ?? "").replace(/\/+$/, "");
if (BASE === "") {
  console.log("SITE_BASE absente : la recette connectee ne sait pas quoi viser.");
  process.exit(1);
}

let echecs = 0;
const nonJoues = [];

function verifier(condition, texte, detail = "") {
  if (condition) {
    console.log(`  ok   ${texte}`);
    return true;
  }
  echecs += 1;
  console.log(`  NON  ${texte}${detail ? ` — ${detail}` : ""}`);
  return false;
}

function service() {
  return createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SECRET_KEY, {
    auth: { autoRefreshToken: false, persistSession: false },
    db: { schema: "study" },
  });
}

function connexionSql() {
  return new pg.Client({
    connectionString: process.env.WORKER_DATABASE_URL,
    ssl: { rejectUnauthorized: false },
    application_name: "recette-connectee",
  });
}

/* -------------------------------------------------------------------------- */

titre(`AvecStudy — recette connectee\n${BASE}`);

const marqueur = marqueurUnique();
const sql = connexionSql();
await sql.connect();

const lib = {
  assurerAnnee: null,
  creerClasse: null,
  creerMatiere: null,
  creerCompte: null,
  affecterProfesseur: null,
};

{
  const etablissement = await import("../../src/lib/etablissement.ts");
  lib.assurerAnnee = etablissement.assurerAnnee;
  lib.creerClasse = etablissement.creerClasse;
  lib.creerMatiere = etablissement.creerMatiere;
  lib.creerCompte = etablissement.creerCompte;
  lib.affecterProfesseur = etablissement.affecterProfesseur;
}

const { rows: exploitants } = await sql.query(
  "select profile_id from study_prive.editor_staff where state = 'active' limit 1",
);
if (exploitants.length === 0) {
  console.log("Aucun exploitant actif : impossible de creer un etablissement de recette.");
  await sql.end();
  process.exit(1);
}

let terrain = null;
let navigateur = null;

try {
  console.log("\n0. Terrain de recette");
  navigateur = await ouvrirNavigateur();

  terrain = await preparerTerrain({
    service: service(),
    exploitant: exploitants[0].profile_id,
    marqueur,
    lib,
    /**
     * L'activation de l'administrateur, jouée dans le navigateur.
     *
     * Ce n'est pas seulement une étape d'installation : c'est le seul moment
     * où l'on voit un administrateur traverser l'activation **et** l'enrôlement
     * du second facteur par l'interface. Ce qu'elle rend — mot de passe
     * définitif et clé TOTP — reste en mémoire.
     */
    activerAdministrateur: async (identite) => {
      const { contexte, page } = await contexteDe(navigateur);
      try {
        const session = await connecter(page, BASE, identite);
        if (!session.destination.startsWith("/admin")) {
          const titre = await page.locator("h1").first().innerText().catch(() => "(aucun h1)");
          console.log(`       diagnostic : arrive sur ${session.destination} — « ${titre} »`);
        }
        verifier(
          session.secretTotp !== null,
          "l administrateur active son compte et enrole son second facteur",
        );
        verifier(
          session.destination.startsWith("/admin"),
          "il arrive bien dans son espace d administration",
          session.destination,
        );
        return session;
      } finally {
        await contexte.close();
      }
    },
  });
  verifier(true, `etablissement ${terrain.code}, 2 classes, 1 professeur, 3 eleves`);

  await scenarioStudio({ navigateur, base: BASE, terrain, sql, verifier, service: service() });
  await scenarioClasse({ navigateur, base: BASE, terrain, sql, verifier });
} catch (erreur) {
  echecs += 1;
  console.log(`\n  ERREUR : ${erreur.message}`);
} finally {
  console.log("\nNettoyage du terrain");

  if (navigateur !== null) await navigateur.close().catch(() => {});

  try {
    // On balaie par marquage, jamais par liste : un terrain créé puis
    // abandonné par une erreur survenue trois lignes plus loin n'est dans
    // aucune liste — mais il porte son code `RECETTE`.
    const bilan = await balayer(sql, service(), { trace: (ligne) => console.log(ligne) });
    console.log(`  ${bilan.etablissements} etablissement(s), ${bilan.profils} compte(s) demontes.`);

    const restes = await residuDeRecette(sql);

    if (restes.length > 0) {
      echecs += 1;
      console.log("  CRITIQUE : la recette connectee a laisse des traces :");
      for (const reste of restes) console.log(`    - ${reste}`);
    } else {
      console.log("  terrain demonte, plus aucune trace.");
    }
  } catch (erreur) {
    echecs += 1;
    console.log(`  CRITIQUE : le nettoyage a echoue — ${erreur.message}`);
  } finally {
    await sql.end().catch(() => {});
  }
}

console.log("\n" + "-".repeat(72));
if (nonJoues.length > 0) {
  console.log(`${nonJoues.length} scenario(s) non joue(s) :`);
  for (const nom of nonJoues) console.log(`  - ${nom}`);
}
console.log(echecs === 0 ? "Recette connectee : aucun defaut." : `Recette connectee : ${echecs} defaut(s).`);
process.exitCode = echecs === 0 ? 0 : 1;
