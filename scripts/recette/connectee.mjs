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
import { ouvrirNavigateur } from "./navigateur.mjs";
import { demonterDemandes, demonterEtablissement, demonterProfils, residuDeRecette } from "./nettoyage.mjs";
import { marqueurUnique, preparerTerrain } from "./terrain.mjs";
import { scenarioStudio } from "./scenario-studio.mjs";

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
  terrain = await preparerTerrain({
    service: service(),
    exploitant: exploitants[0].profile_id,
    marqueur,
    lib,
  });
  verifier(true, `etablissement ${terrain.code}, 2 classes, 1 professeur, 3 eleves`);

  navigateur = await ouvrirNavigateur();

  await scenarioStudio({ navigateur, base: BASE, terrain, sql, verifier, service: service() });
} catch (erreur) {
  echecs += 1;
  console.log(`\n  ERREUR : ${erreur.message}`);
} finally {
  console.log("\nNettoyage du terrain");

  if (navigateur !== null) await navigateur.close().catch(() => {});

  try {
    if (terrain !== null) {
      const profils = [
        terrain.administrateur.id,
        ...Object.values(terrain.comptes).map((compte) => compte.id).filter(Boolean),
      ];

      await demonterEtablissement(sql, terrain.organisation, { trace: () => {} });
      await demonterProfils(sql, profils, { trace: () => {} });
      await demonterDemandes(sql, { trace: () => {} });

      const fournisseur = service();
      for (const profil of profils) {
        await fournisseur.auth.admin.deleteUser(profil).catch(() => undefined);
      }
    }

    const restes = await residuDeRecette(sql, {
      organisations: terrain === null ? [] : [terrain.organisation],
    });

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
