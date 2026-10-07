// =============================================================================
// Capture et restauration fidèles des données — partagé par
// scripts/sauvegarde-production.mjs et scripts/restaurer-sauvegarde.mjs.
//
// Format 2 : chaque ligne est capturée par PostgreSQL lui-même (`to_jsonb`),
// pas reconstruite par le pilote JavaScript. Les horodatages gardent leurs
// microsecondes, les `bytea` restent en hexadécimal, les grands entiers ne
// passent pas par un nombre flottant. La restauration relit ces lignes avec
// `jsonb_populate_record` : l'aller-retour est exact, et il est vérifié ligne
// à ligne après restauration.
//
// Format 1 (sauvegardes antérieures) : sérialisé par le pilote, donc
// horodatages tronqués à la milliseconde et `bytea` en objet Buffer. Il se
// restaure (conversion des Buffer), mais la vérification se limite au compte
// des lignes.
//
// `sql` est tout objet doté de `query(texte, params) → { rows }` : un client
// `pg` ou une base PGlite (tests).
// =============================================================================

import { createHash } from "node:crypto";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

export const SCHEMAS_METIER = ["study", "study_prive"];
/**
 * Comptes Supabase Auth : sans eux, une base restaurée a des profils mais
 * personne ne peut s'y connecter (mots de passe et seconds facteurs vivent
 * dans `auth`). Contiennent des empreintes de mots de passe : capture sur
 * demande explicite seulement (`--avec-comptes`).
 */
export const TABLES_COMPTES = [
  ["auth", "users"],
  ["auth", "identities"],
  ["auth", "mfa_factors"],
];

export const empreinte = (texte) => createHash("sha256").update(texte, "utf8").digest("hex");

/** Tables à capturer, dans un ordre stable. */
export async function tablesACapturer(sql, { avecComptes = false } = {}) {
  const { rows } = await sql.query(
    `select n.nspname as schema, c.relname as table
       from pg_class c join pg_namespace n on n.oid = c.relnamespace
      where n.nspname = any($1) and c.relkind = 'r'
      order by 1, 2`,
    [SCHEMAS_METIER],
  );
  if (avecComptes) {
    for (const [schema, table] of TABLES_COMPTES) {
      const { rows: r } = await sql.query("select to_regclass($1) is not null as existe", [`${schema}.${table}`]);
      if (r[0].existe) rows.push({ schema, table });
    }
  }
  return rows;
}

/**
 * Structure des tables de comptes (colonnes, types, types énumérés). Sert à
 * les recréer dans une base de recette qui n'est pas un projet Supabase : la
 * restauration y est alors exacte, colonne pour colonne.
 */
export async function capturerStructureComptes(sql) {
  const tables = [];
  const types = new Map();
  for (const [schema, table] of TABLES_COMPTES) {
    const { rows: existe } = await sql.query("select to_regclass($1) is not null as e", [`${schema}.${table}`]);
    if (!existe[0].e) continue;
    const { rows: colonnes } = await sql.query(
      `select a.attname as nom, format_type(a.atttypid, a.atttypmod) as type, a.attnotnull as requis,
              t.typtype, tn.nspname as type_schema, t.typname as type_nom,
              coalesce((select array_agg(e.enumlabel::text order by e.enumsortorder) from pg_enum e where e.enumtypid = t.oid), '{}'::text[]) as valeurs
         from pg_attribute a join pg_type t on t.oid = a.atttypid join pg_namespace tn on tn.oid = t.typnamespace
        where a.attrelid = $1::regclass and a.attnum > 0 and not a.attisdropped and a.attgenerated = ''
        order by a.attnum`,
      [`${schema}.${table}`],
    );
    const { rows: pk } = await sql.query(
      `select array_agg(a.attname::text order by a.attnum) as cols from pg_index i
         join pg_attribute a on a.attrelid = i.indrelid and a.attnum = any(i.indkey)
        where i.indrelid = $1::regclass and i.indisprimary`,
      [`${schema}.${table}`],
    );
    for (const c of colonnes) if (c.typtype === "e") types.set(`${c.type_schema}.${c.type_nom}`, { schema: c.type_schema, nom: c.type_nom, valeurs: c.valeurs });
    tables.push({ schema, table, colonnes: colonnes.map((c) => ({ nom: c.nom, type: c.type, requis: c.requis })), cle: pk[0]?.cols ?? [] });
  }
  return { types: [...types.values()], tables };
}

/** Recrée la structure de comptes capturée, dans une base de recette vide de ce schéma. */
export async function creerStructureComptes(sql, structure) {
  const q = (s) => `"${s.replace(/"/g, '""')}"`;
  for (const s of new Set([...structure.types.map((t) => t.schema), ...structure.tables.map((t) => t.schema)])) await sql.query(`create schema if not exists ${q(s)}`);
  for (const t of structure.types) {
    await sql.query(`create type ${q(t.schema)}.${q(t.nom)} as enum (${t.valeurs.map((v) => `'${v.replace(/'/g, "''")}'`).join(", ")})`);
  }
  for (const t of structure.tables) {
    const cols = t.colonnes.map((c) => `${q(c.nom)} ${c.type}${c.requis ? " not null" : ""}`);
    if (t.cle.length) cols.push(`primary key (${t.cle.map(q).join(", ")})`);
    await sql.query(`create table ${q(t.schema)}.${q(t.table)} (${cols.join(", ")})`);
  }
}

/**
 * Les lignes d'une table, rendues par PostgreSQL en JSONB (texte exact).
 * Fuseau de session fixé à UTC : le texte ne dépend pas du serveur.
 */
export async function capturerTable(sql, schema, table) {
  await sql.query("set timezone to 'UTC'");
  const { rows } = await sql.query(`select to_jsonb(x)::text as r from "${schema}"."${table}" x order by 1`);
  return `[${rows.map((l) => l.r).join(",\n")}]`;
}

/* ========================================================================== */
/* Restauration                                                               */
/* ========================================================================== */

/** Convertit une valeur du format 1 (Buffer sérialisé) en hexadécimal bytea. */
function depuisFormat1(valeur) {
  if (Array.isArray(valeur)) return valeur.map(depuisFormat1);
  if (valeur && typeof valeur === "object") {
    if (valeur.type === "Buffer" && Array.isArray(valeur.data)) return "\\x" + Buffer.from(valeur.data).toString("hex");
    return Object.fromEntries(Object.entries(valeur).map(([k, v]) => [k, depuisFormat1(v)]));
  }
  return valeur;
}

/** Ordre d'insertion respectant les clés étrangères entre tables restaurées. */
async function ordonner(sql, tables) {
  const noms = new Set(tables.map((t) => `${t.schema}.${t.table}`));
  const { rows } = await sql.query(
    `select cn.nspname || '.' || c.relname as de, rn.nspname || '.' || r.relname as vers
       from pg_constraint k
       join pg_class c on c.oid = k.conrelid join pg_namespace cn on cn.oid = c.relnamespace
       join pg_class r on r.oid = k.confrelid join pg_namespace rn on rn.oid = r.relnamespace
      where k.contype = 'f' and k.conrelid <> k.confrelid`,
  );
  const dependances = new Map([...noms].map((n) => [n, new Set()]));
  for (const { de, vers } of rows) if (noms.has(de) && noms.has(vers)) dependances.get(de).add(vers);
  const ordre = [];
  const faits = new Set();
  while (ordre.length < noms.size) {
    const prets = [...noms].filter((n) => !faits.has(n) && [...dependances.get(n)].every((d) => faits.has(d)));
    if (prets.length === 0) throw new Error("cycle de cles etrangeres : " + [...noms].filter((n) => !faits.has(n)).join(", "));
    for (const n of prets.sort()) { ordre.push(n); faits.add(n); }
  }
  return ordre.map((n) => tables.find((t) => `${t.schema}.${t.table}` === n));
}

/**
 * Restaure une sauvegarde dans une base au même schéma, dont les tables
 * concernées sont vides. Une seule transaction : tout ou rien.
 * Renvoie le compte rendu de vérification, table par table.
 */
export async function restaurer(sql, dossier, { journal = () => {} } = {}) {
  const manifeste = JSON.parse(readFileSync(path.join(dossier, "manifeste.json"), "utf8"));
  const format = manifeste.format ?? 1;
  // Les horodatages sont rendus dans le fuseau de la session : capture et
  // comparaison se font en UTC, quel que soit le réglage du serveur.
  await sql.query("set timezone to 'UTC'");

  for (const f of manifeste.fichiers) {
    const contenu = readFileSync(path.join(dossier, f.fichier), "utf8");
    if (empreinte(contenu) !== f.sha256) throw new Error(`empreinte differente : ${f.fichier}`);
  }

  const tables = manifeste.fichiers
    .map((f) => f.fichier.replace(/\\/g, "/"))
    .filter((f) => f.startsWith("donnees/"))
    .map((f) => {
      const [schema, ...reste] = path.basename(f, ".json").split(".");
      return { schema, table: reste.join("."), fichier: f };
    });

  // Une table déjà remplie n'est acceptée que si les migrations y ont posé
  // exactement les lignes sauvegardées (données de référence) : elle est
  // alors laissée telle quelle. Toute autre table doit être vide.
  // Comparaison sur les colonnes stockées de la cible : une colonne générée
  // (auth.users.confirmed_at, auth.identities.email chez Supabase) se déduit
  // des autres et n'est pas recréée hors Supabase.
  const ecartsAvec = async (cible, texte) => {
    const { rows: cols } = await sql.query(
      "select array_agg(attname::text) as c from pg_attribute where attrelid = $1::regclass and attnum > 0 and not attisdropped and attgenerated = ''",
      [cible],
    );
    return (
      await sql.query(
        `with b as (select (select jsonb_object_agg(key, value) from jsonb_each(v) where key = any($2)) as v from jsonb_array_elements($1::jsonb) e(v)),
              t as (select (select jsonb_object_agg(key, value) from jsonb_each(to_jsonb(x)) where key = any($2)) as r from ${cible} x)
         select count(*)::int as n from b full join t on t.r = b.v where t.r is null or b.v is null`,
        [texte, cols[0].c],
      )
    ).rows[0].n;
  };
  const deReference = new Set();
  for (const t of tables) {
    const cible = `"${t.schema}"."${t.table}"`;
    const { rows } = await sql.query("select to_regclass($1) is not null as existe", [cible]);
    if (!rows[0].existe) throw new Error(`table absente de la base cible : ${t.schema}.${t.table} (schema different de celui de la sauvegarde ?)`);
    const { rows: n } = await sql.query(`select exists (select 1 from ${cible}) as pleine`);
    if (!n[0].pleine) continue;
    if (format >= 2 && (await ecartsAvec(cible, readFileSync(path.join(dossier, t.fichier), "utf8"))) === 0) deReference.add(t.fichier);
    else throw new Error(`la base cible n est pas vide : ${t.schema}.${t.table}`);
  }

  const ordre = await ordonner(sql, tables);
  const compteRendu = [];
  await sql.query("begin");
  try {
    for (const t of ordre) {
      const cible = `"${t.schema}"."${t.table}"`;
      let lignes = JSON.parse(readFileSync(path.join(dossier, t.fichier), "utf8"));
      if (format === 1) lignes = depuisFormat1(lignes);
      if (lignes.length === 0 || deReference.has(t.fichier)) continue;
      // Colonnes insérables : ni générées, ni supprimées.
      const { rows: cols } = await sql.query(
        `select a.attname as nom from pg_attribute a
          where a.attrelid = $1::regclass and a.attnum > 0 and not a.attisdropped and a.attgenerated = ''
          order by a.attnum`,
        [cible],
      );
      const liste = cols.map((c) => `"${c.nom}"`).join(", ");
      const metier = t.schema === "study" || t.schema === "study_prive";
      // Les déclencheurs métier (immutabilité, audit, file de travaux) ne
      // doivent pas réécrire ni refuser les lignes d'origine.
      if (metier) await sql.query(`alter table ${cible} disable trigger user`);
      await sql.query(
        `insert into ${cible} (${liste}) overriding system value
         select ${liste} from jsonb_populate_recordset(null::${cible}, $1::jsonb)`,
        [JSON.stringify(lignes)],
      );
      if (metier) await sql.query(`alter table ${cible} enable trigger user`);
      journal(`  ${`${t.schema}.${t.table}`.padEnd(46)} ${lignes.length}`);
    }

    // Séquences : reprendre après la plus grande valeur restaurée.
    const { rows: seqs } = await sql.query(
      `select n.nspname as schema, c.relname as table, a.attname as colonne,
              pg_get_serial_sequence(format('%I.%I', n.nspname, c.relname), a.attname) as sequence
         from pg_attribute a join pg_class c on c.oid = a.attrelid join pg_namespace n on n.oid = c.relnamespace
        where n.nspname = any($1) and c.relkind = 'r' and a.attnum > 0 and not a.attisdropped
          and pg_get_serial_sequence(format('%I.%I', n.nspname, c.relname), a.attname) is not null`,
      [SCHEMAS_METIER],
    );
    for (const s of seqs) {
      await sql.query(
        `select setval($1, greatest(coalesce((select max("${s.colonne}") from "${s.schema}"."${s.table}"), 0), 1),
                       (select max("${s.colonne}") from "${s.schema}"."${s.table}") is not null)`,
        [s.sequence],
      );
    }

    // Vérification ligne à ligne (format 2) ou au compte (format 1).
    for (const t of tables) {
      const cible = `"${t.schema}"."${t.table}"`;
      const texte = readFileSync(path.join(dossier, t.fichier), "utf8");
      const attendu = manifeste.fichiers.find((f) => f.fichier.replace(/\\/g, "/") === t.fichier).lignes;
      const { rows: n } = await sql.query(`select count(*)::int as n from ${cible}`);
      let ecarts = null;
      if (format >= 2) {
        ecarts = await ecartsAvec(cible, texte);
      }
      compteRendu.push({ table: `${t.schema}.${t.table}`, attendu, restaure: n[0].n, ecarts });
    }
    const fautes = compteRendu.filter((c) => c.attendu !== c.restaure || (c.ecarts ?? 0) > 0);
    if (fautes.length > 0) throw new Error("restauration non conforme : " + fautes.map((f) => `${f.table} (${f.restaure}/${f.attendu}, ecarts ${f.ecarts})`).join(", "));
    await sql.query("commit");
  } catch (erreur) {
    await sql.query("rollback").catch(() => {});
    throw erreur;
  }
  return { format, tables: compteRendu };
}

export function lireManifeste(dossier) {
  const p = path.join(dossier, "manifeste.json");
  if (!existsSync(p)) throw new Error(`Aucun manifeste dans ${dossier}`);
  return JSON.parse(readFileSync(p, "utf8"));
}
