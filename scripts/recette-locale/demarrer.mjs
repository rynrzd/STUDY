#!/usr/bin/env node
// Démarre le PostgreSQL 17 de recette locale (voir environnement.mjs).
// Laisser tourner ; Ctrl+C l'arrête proprement.
//
//   node scripts/recette-locale/demarrer.mjs

import { existsSync } from "node:fs";
import path from "node:path";
import { PORT, RACINE_RECETTE, motDePasse, restreindre } from "./environnement.mjs";

let EmbeddedPostgres;
try {
  ({ default: EmbeddedPostgres } = await import("embedded-postgres"));
} catch {
  console.error("embedded-postgres absent : npm install --no-save embedded-postgres@17.10.0-beta.17");
  process.exit(1);
}

const DONNEES = path.join(RACINE_RECETTE, "donnees");
const neuf = !existsSync(DONNEES);
const serveur = new EmbeddedPostgres({
  databaseDir: DONNEES,
  user: "postgres",
  password: motDePasse(),
  port: PORT,
  persistent: true,
  postgresFlags: ["-c", "listen_addresses=127.0.0.1"],
  initdbFlags: ["--encoding=UTF8", "--locale=C"],
});
if (neuf) {
  await serveur.initialise();
  restreindre(DONNEES);
}
await serveur.start();
console.log(`PostgreSQL de recette pret sur 127.0.0.1:${PORT} (donnees : ${RACINE_RECETTE}, acces restreint a ${process.env.USERNAME ?? "l utilisateur courant"}).`);
const arreter = async () => {
  await serveur.stop();
  process.exit(0);
};
process.on("SIGINT", arreter);
process.on("SIGTERM", arreter);
setInterval(() => {}, 1 << 30);
