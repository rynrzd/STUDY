#!/usr/bin/env node
/**
 * Compare la base réelle à l'état attendu — `npm run verifier:schema`.
 *
 * Par défaut, l'état attendu après TOUTES les migrations. Un argument permet
 * de s'arrêter à une migration précise : `npm run verifier:schema -- 0011`.
 *
 * Pourquoi : la base porte déjà un schéma, mais la table de suivi est vide.
 * Avant de déclarer des migrations « déjà appliquées », il faut vérifier que ce
 * qui est en place correspond exactement à ce qu'elles produisent — sinon on
 * masquerait un écart au lieu de le corriger.
 *
 * La comparaison porte sur l'empreinte structurelle : tables, colonnes, types
 * énumérés, contraintes, index uniques, politiques RLS et fonctions. Aucune
 * donnée n'est lue, aucun secret affiché.
 */
import { PGlite } from "@electric-sql/pglite";
import pg from "pg";
import { readFile, readdir } from "node:fs/promises";
import path from "node:path";
import { chargerEnv, RACINE } from "./_commun.mjs";

chargerEnv();

const JUSQUA = process.argv[2] ?? "9999";

/* --- Base de référence : migrations rejouées sur PostgreSQL embarqué ------- */

const dossier = path.join(RACINE, "supabase", "migrations");
const fichiers = (await readdir(dossier)).filter((f) => f.endsWith(".sql")).sort();
const retenus = fichiers.filter((f) => f.slice(0, 4) <= JUSQUA);

const reference = await PGlite.create();
for (const fichier of retenus) {
  await reference.exec(await readFile(path.join(dossier, fichier), "utf8"));
}

/* --- Base réelle ----------------------------------------------------------- */

const reelle = new pg.Client({
  connectionString: process.env.WORKER_DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 15_000,
  application_name: "avecstudy-comparaison",
});
await reelle.connect();

/* --- Empreintes ------------------------------------------------------------ */

const REQUETES = {
  "tables": `
    select table_schema || '.' || table_name as e
      from information_schema.tables
     where table_schema in ('study','study_prive') and table_type='BASE TABLE'
     order by 1`,

  "colonnes": `
    select table_schema || '.' || table_name || '.' || column_name || ':' || data_type
             || ':' || is_nullable as e
      from information_schema.columns
     where table_schema in ('study','study_prive')
     order by 1`,

  "types enumeres": `
    select n.nspname || '.' || t.typname || '=' ||
           string_agg(e.enumlabel, ',' order by e.enumsortorder) as e
      from pg_type t
      join pg_namespace n on n.oid = t.typnamespace
      join pg_enum e on e.enumtypid = t.oid
     where n.nspname in ('study','study_prive')
     group by n.nspname, t.typname
     order by 1`,

  // Les entrées « %_not_null » sont une différence de catalogue entre la
  // version de PostgreSQL embarquée et celle de Supabase, pas une différence
  // de schéma : la colonne est NOT NULL des deux côtés.
  "contraintes": `
    select ns.nspname || '.' || rel.relname || '.' || con.conname as e
      from pg_constraint con
      join pg_class rel on rel.oid = con.conrelid
      join pg_namespace ns on ns.oid = rel.relnamespace
     where ns.nspname in ('study','study_prive')
       and con.conname not like '%\\_not\\_null'
     order by 1`,

  "index": `
    select schemaname || '.' || indexname as e
      from pg_indexes where schemaname in ('study','study_prive')
     order by 1`,

  "politiques RLS": `
    select schemaname || '.' || tablename || '.' || policyname || ':' || cmd as e
      from pg_policies where schemaname in ('study','study_prive')
     order by 1`,

  "fonctions": `
    select n.nspname || '.' || p.proname as e
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname in ('study','study_prive')
     order by 1`,
};

let ecarts = 0;

for (const [nom, sql] of Object.entries(REQUETES)) {
  const attendu = new Set((await reference.query(sql)).rows.map((r) => r.e));
  const present = new Set((await reelle.query(sql)).rows.map((r) => r.e));

  const manquants = [...attendu].filter((x) => !present.has(x));
  const enTrop = [...present].filter((x) => !attendu.has(x));

  if (manquants.length === 0 && enTrop.length === 0) {
    console.log(`  identique   ${nom} (${attendu.size})`);
    continue;
  }

  ecarts += manquants.length + enTrop.length;
  console.log(`  ECART       ${nom} : ${manquants.length} manquant(s), ${enTrop.length} en trop`);
  for (const x of manquants.slice(0, 12)) console.log(`      manquant : ${x}`);
  for (const x of enTrop.slice(0, 12)) console.log(`      en trop  : ${x}`);
  if (manquants.length > 12 || enTrop.length > 12) console.log("      …");
}

/* --- Y a-t-il des donnees ? ------------------------------------------------ */

const { rows } = await reelle.query(`
  select relname, n_live_tup
    from pg_stat_user_tables
   where schemaname in ('study','study_prive') and n_live_tup > 0
   order by n_live_tup desc`);

console.log(`\n  lignes presentes : ${rows.length === 0 ? "aucune (base vierge de donnees)" : ""}`);
for (const ligne of rows) console.log(`      ${ligne.relname} : ${ligne.n_live_tup}`);

await reference.close();
await reelle.end();

console.log(
  `\n  => ${ecarts === 0 ? `structure IDENTIQUE a l'etat attendu apres ${JUSQUA}` : `${ecarts} ecart(s)`}`,
);
process.exitCode = ecarts === 0 ? 0 : 1;
