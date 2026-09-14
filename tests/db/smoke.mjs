import { appliquerMigrations, chargerSeed } from "./harness.mjs";
import { PGlite } from "@electric-sql/pglite";

const db = await PGlite.create();
const fichiers = await appliquerMigrations(db);
console.log("migrations appliquees :", fichiers.join(", "));
await chargerSeed(db);
const t = await db.query(
  "select count(*)::int as n from pg_tables where schemaname = 'study'");
const p = await db.query(
  "select count(*)::int as n from pg_policies where schemaname = 'study'");
console.log("tables study :", t.rows[0].n, "| politiques RLS :", p.rows[0].n);
const sansRls = await db.query(`
  select c.relname from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'study' and c.relkind = 'r' and c.relrowsecurity = false`);
console.log("tables sans RLS :", sansRls.rows.map(r => r.relname).join(", ") || "(aucune)");
await db.close();
