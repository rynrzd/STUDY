#!/usr/bin/env node
// Crée une base de recette vide, migrée jusqu'au niveau de la sauvegarde à
// restaurer, et affiche l'adresse à passer à restaurer-sauvegarde.mjs.
//
//   node scripts/recette-locale/preparer-cible.mjs <nom_de_base> <niveau, ex. 0044>
//   RESTAURE_DATABASE_URL=… node scripts/restaurer-sauvegarde.mjs <dossier> --creer-comptes
//
// L'adresse contient le mot de passe local : elle est écrite dans un fichier
// restreint, pas à l'écran.

import { writeFileSync } from "node:fs";
import path from "node:path";
import { RACINE_RECETTE, client, migrer, url } from "./environnement.mjs";

const [nom, niveau] = process.argv.slice(2);
if (!/^[a-z_][a-z0-9_]{0,40}$/.test(nom ?? "") || !/^\d{4}$/.test(niveau ?? "")) {
  console.error("Usage : node scripts/recette-locale/preparer-cible.mjs <nom_de_base> <niveau, ex. 0044>");
  process.exit(1);
}
const admin = await client("postgres");
const existe = (await admin.query("select 1 from pg_database where datname = $1", [nom])).rowCount > 0;
if (existe) {
  console.error(`La base ${nom} existe deja : choisir un autre nom (rien n est ecrase).`);
  process.exit(1);
}
await admin.query(`create database ${nom}`);
await admin.end();
const c = await client(nom);
const temps = await migrer(c, "0000", niveau);
await c.end();
const fichier = path.join(RACINE_RECETTE, `cible-${nom}.env`);
writeFileSync(fichier, `RESTAURE_DATABASE_URL=${url(nom)}\n`, { mode: 0o600 });
console.log(`Base ${nom} migree jusqu a ${niveau} (${temps.length} migrations).`);
console.log(`Adresse ecrite dans ${fichier} (acces restreint).`);
