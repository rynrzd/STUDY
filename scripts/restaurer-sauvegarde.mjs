#!/usr/bin/env node
// =============================================================================
// Restaure une sauvegarde logique dans une base de RECETTE, puis la vérifie
// ligne à ligne.
//
//   RESTAURE_DATABASE_URL=postgres://… node scripts/restaurer-sauvegarde.mjs <dossier>
//   node scripts/restaurer-sauvegarde.mjs <dossier> --creer-comptes --cible <fichier .env>
//
// La base cible doit porter le même schéma que la base sauvegardée (migrations
// appliquées jusqu'au même numéro) et des tables vides. Une seule transaction :
// en cas d'écart, rien n'est écrit.
//
// Garde-fous : refuse toute cible dont l'hôte est celui de WORKER_DATABASE_URL
// ou de SUPABASE_URL (la production, dans .env.local), et refuse de tourner
// sans RESTAURE_DATABASE_URL explicite. Une sauvegarde porte des données
// réelles d'élèves : la base de recette qui la reçoit doit être d'accès
// restreint (voir docs/plan-de-recuperation.md).
// =============================================================================

import path from "node:path";
import pg from "pg";
import { RACINE, chargerEnv, titre } from "./_commun.mjs";
import { existsSync, readFileSync } from "node:fs";
import { creerStructureComptes, lireManifeste, restaurer } from "./sauvegarde-donnees.mjs";

chargerEnv();
titre("AvecStudy — restauration d une sauvegarde en recette");

// --cible <fichier> : fichier écrit par recette-locale/preparer-cible.mjs
// (RESTAURE_DATABASE_URL=…), pour ne jamais recopier l'adresse à la main.
const iCible = process.argv.indexOf("--cible");
const depuisFichier =
  iCible !== -1 ? (readFileSync(process.argv[iCible + 1], "utf8").match(/^RESTAURE_DATABASE_URL=(.+)$/m) ?? [])[1] ?? "" : "";
const cible = (process.env.RESTAURE_DATABASE_URL || depuisFichier).trim();
const nom = process.argv[2] ?? "";
if (cible === "" || nom === "") {
  console.error("Usage : RESTAURE_DATABASE_URL=postgres://… node scripts/restaurer-sauvegarde.mjs <dossier> [--creer-comptes] [--cible <fichier .env>]");
  process.exit(1);
}

const lire = (url) => {
  try {
    const u = new URL(url);
    return { hote: u.hostname.toLowerCase(), port: u.port || "5432", base: u.pathname.replace(/^\//, ""), utilisateur: decodeURIComponent(u.username) };
  } catch {
    return null;
  }
};
const LOCAUX = new Set(["127.0.0.1", "localhost"]);
const c = lire(cible);
const source = lire(process.env.WORKER_DATABASE_URL ?? "");
const refProduction = (lire(process.env.SUPABASE_URL ?? "")?.hote ?? "").split(".")[0];
const refus = [
  // Même serveur, même base, même utilisateur que la base de l'environnement courant.
  source && c && c.hote === source.hote && c.port === source.port && c.base === source.base && c.utilisateur === source.utilisateur,
  // Même hôte distant que la production (un pooler Supabase est partagé : refus par prudence).
  source && c && !LOCAUX.has(c.hote) && c.hote === source.hote,
  // La référence du projet de production apparaît dans l'adresse (hôte direct ou utilisateur du pooler).
  refProduction !== "" && cible.toLowerCase().includes(refProduction),
];
if (c === null || refus.some(Boolean)) {
  console.error("Refus : la cible designe la base de production de l environnement courant.");
  process.exit(1);
}
const hoteCible = c.hote;

const dossier = path.isAbsolute(nom) ? nom : path.join(RACINE, "sauvegardes", nom);
const manifeste = lireManifeste(dossier);
console.log(`Sauvegarde du ${manifeste.horodatage}, format ${manifeste.format ?? 1}, ${manifeste.totaux.lignes} ligne(s)` + (manifeste.comptes ? ", comptes inclus" : ", SANS comptes"));

const local = hoteCible === "127.0.0.1" || hoteCible === "localhost";
const sql = new pg.Client({ connectionString: cible, ssl: local ? false : { rejectUnauthorized: false }, application_name: "restauration-recette" });
await sql.connect();
try {
  if (manifeste.migrations) console.log(`Niveau de migration de la sauvegarde : ${manifeste.migrations.at(-1)} — la base cible doit etre migree jusque-la.`);
  // Base de recette qui n'est pas un projet Supabase : recréer les tables de
  // comptes à l'identique de la structure capturée.
  const structure = path.join(dossier, "structure-comptes.json");
  if (process.argv.includes("--creer-comptes") && existsSync(structure)) {
    const { rows } = await sql.query("select to_regclass('auth.users') is not null as e");
    if (rows[0].e) throw new Error("--creer-comptes : auth.users existe deja dans la cible");
    await sql.query("begin");
    try {
      await creerStructureComptes(sql, JSON.parse(readFileSync(structure, "utf8")));
      await sql.query("commit");
    } catch (erreur) {
      await sql.query("rollback");
      throw erreur;
    }
    console.log("Structure des comptes recreee (auth).");
  }
  console.log("\nRestauration");
  const r = await restaurer(sql, dossier, { journal: console.log });
  const ecarts = r.tables.reduce((s, t) => s + (t.ecarts ?? 0), 0);
  console.log("\n" + "-".repeat(72));
  console.log(`${r.tables.length} table(s) restauree(s), ${r.tables.reduce((s, t) => s + t.restaure, 0)} ligne(s).`);
  console.log(r.format >= 2 ? `Verification ligne a ligne : ${ecarts} ecart(s).` : "Format 1 : verification au compte des lignes seulement.");
} catch (erreur) {
  console.error(`\nRestauration annulee (rien n a ete ecrit) : ${erreur.message}`);
  process.exitCode = 1;
} finally {
  await sql.end();
}
