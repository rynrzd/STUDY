#!/usr/bin/env node
// =============================================================================
// Engendre supabase/retour-arriere/retour-0057-0045.sql par comparaison des
// catalogues : base embarquée à l'état 0044, puis la même à l'état 0057.
//
//   node scripts/engendrer-retour-arriere.mjs
//
// Aucune base réelle n'est lue : les deux états sont construits en mémoire à
// partir des fichiers de migration du dépôt. Le fichier produit est une pièce
// versionnée et relue ; il est prouvé par tests/db/v7-retour-complet.test.mjs
// (catalogue identique à 0044 après exécution, données d'avant conservées).
//
// Ce que le script couvre : tables, colonnes, contraintes, index, politiques,
// déclencheurs, fonctions (définition et droits d'exécution), types, vues,
// séquences et droits de table des schémas study et study_prive. Ce qu'il ne
// couvre pas est refusé : toute différence non traitée fait échouer la
// génération plutôt que de produire un script incomplet.
// =============================================================================

import { PGlite } from "@electric-sql/pglite";
import { writeFileSync } from "node:fs";
import path from "node:path";
import { RACINE } from "./_commun.mjs";
import { appliquerMigrations } from "../tests/db/harness.mjs";

const SCHEMAS = ["study", "study_prive"];
const q = (s) => `"${s.replace(/"/g, '""')}"`;

/** Catalogue comparable des schémas study et study_prive d'une base ouverte. */
export async function lireCatalogue(db) {
  const r = async (sql) => (await db.query(sql, [SCHEMAS])).rows;
  const c = {
    tables: await r(`select n.nspname s, c.relname t, c.relkind k from pg_class c join pg_namespace n on n.oid=c.relnamespace
                      where n.nspname = any($1) and c.relkind in ('r','v','m','S','p') order by 1,2`),
    colonnes: await r(`select n.nspname s, c.relname t, a.attname col, format_type(a.atttypid,a.atttypmod) ty, a.attnum num
                         from pg_attribute a join pg_class c on c.oid=a.attrelid join pg_namespace n on n.oid=c.relnamespace
                        where n.nspname = any($1) and c.relkind in ('r','p') and a.attnum>0 and not a.attisdropped order by 1,2,5`),
    contraintes: await r(`select n.nspname s, c.relname t, k.conname nom, pg_get_constraintdef(k.oid) def, k.contype ty
                            from pg_constraint k join pg_class c on c.oid=k.conrelid join pg_namespace n on n.oid=c.relnamespace
                           where n.nspname = any($1) order by 1,2,3`),
    index: await r(`select n.nspname s, i.relname nom, t.relname t, pg_get_indexdef(i.oid) def
                      from pg_index x join pg_class i on i.oid=x.indexrelid join pg_class t on t.oid=x.indrelid
                      join pg_namespace n on n.oid=i.relnamespace
                     where n.nspname = any($1) and not exists (select 1 from pg_constraint k where k.conindid=i.oid) order by 1,2`),
    politiques: await r(`select schemaname s, tablename t, policyname nom, permissive, roles::text roles, cmd, qual, with_check
                           from pg_policies where schemaname = any($1) order by 1,2,3`),
    declencheurs: await r(`select n.nspname s, c.relname t, g.tgname nom, pg_get_triggerdef(g.oid) def
                             from pg_trigger g join pg_class c on c.oid=g.tgrelid join pg_namespace n on n.oid=c.relnamespace
                            where n.nspname = any($1) and not g.tgisinternal order by 1,2,3`),
    fonctions: await r(`select n.nspname s, p.proname nom, pg_get_function_identity_arguments(p.oid) args,
                               pg_get_function_result(p.oid) retour, pg_get_functiondef(p.oid) def, p.prokind kind,
                               coalesce((select string_agg(a, ',' order by a) from unnest(p.proacl::text[]) a), '') acl
                          from pg_proc p join pg_namespace n on n.oid=p.pronamespace where n.nspname = any($1) order by 1,2,3`),
    types: await r(`select n.nspname s, t.typname nom, t.typtype ty,
                           coalesce((select string_agg(e.enumlabel, ',' order by e.enumsortorder) from pg_enum e where e.enumtypid=t.oid), '') valeurs
                      from pg_type t join pg_namespace n on n.oid=t.typnamespace
                     where n.nspname = any($1) and t.typtype in ('e','d','c') and not exists (select 1 from pg_class c where c.reltype=t.oid) order by 1,2`),
    droits: await r(`select table_schema s, table_name t, grantee g, privilege_type p from information_schema.role_table_grants
                      where table_schema = any($1) order by 1,2,3,4`),
    rls: await r(`select n.nspname s, c.relname t, c.relrowsecurity rls, c.relforcerowsecurity force
                    from pg_class c join pg_namespace n on n.oid=c.relnamespace where n.nspname = any($1) and c.relkind='r' order by 1,2`),
  };
  // Fins de ligne : selon la machine, les migrations d'avant 0040 sont
  // extraites en CRLF ou en LF (.gitattributes impose LF dans le dépôt). Un
  // retour chariot dans le corps d'une fonction ne change rien à son
  // comportement : il est neutralisé pour que la comparaison et le script
  // engendré ne dépendent pas du poste.
  const sansCR = (v) => (typeof v === "string" ? v.split(String.fromCharCode(13)).join("") : v);
  for (const partie of Object.values(c)) for (const ligne of partie) for (const k of Object.keys(ligne)) ligne[k] = sansCR(ligne[k]);
  return c;
}

async function catalogue(jusqua) {
  const db = await PGlite.create();
  await appliquerMigrations(db, { jusqua });
  const c = await lireCatalogue(db);
  await db.close();
  return c;
}

const cle = (o, ...champs) => champs.map((c) => o[c]).join("|");

export async function engendrer() {
  const avant = await catalogue("0044");
  const apres = await catalogue("0057");
  const out = [];
  const non = [];
  const ecrire = (...l) => out.push(...l);

  const tablesAvant = new Set(avant.tables.map((x) => cle(x, "s", "t")));
  const nouvellesTables = apres.tables.filter((x) => !tablesAvant.has(cle(x, "s", "t")));
  const anciennes = (x) => tablesAvant.has(cle(x, "s", "t"));
  for (const x of avant.tables) if (!apres.tables.some((y) => cle(y, "s", "t") === cle(x, "s", "t"))) non.push(`objet supprime par 0045-0057 : ${x.s}.${x.t}`);

  ecrire(
    "-- =========================================================================",
    "-- Retour arriere des migrations 0057 a 0045 — ENGENDRE, NE PAS EDITER A LA MAIN",
    "-- Source : node scripts/engendrer-retour-arriere.mjs",
    "-- Preuve : tests/db/v7-retour-complet.test.mjs",
    "--",
    "-- Prealable : retour-0060.sql puis retour-0059-0058.sql deja executes.",
    "-- PERTE DE DONNEES : toutes les tables creees par 0045-0057 sont supprimees",
    "-- (messagerie, notes et revision, fiches, recherche, vie de classe, projets,",
    "-- agenda, entraide, orientation, ateliers, pieces jointes). Exporter avant.",
    "-- Les tables existantes en 0044 gardent leurs lignes, sauf les lignes qui ne",
    "-- peuvent pas exister dans le schema 0044 (listees en section 1).",
    "-- =========================================================================",
    "",
    "begin;",
    "",
  );

  // --- 1. Lignes incompatibles avec le schéma 0044 ---------------------------
  ecrire("-- 1. Lignes incompatibles avec le schema 0044");
  const colonnesAvant = new Set(avant.colonnes.map((x) => cle(x, "s", "t", "col")));
  const nouvellesColonnes = apres.colonnes.filter((x) => anciennes(x) && !colonnesAvant.has(cle(x, "s", "t", "col")));
  // Signalements portant sur un message de salon : la cible n'existe pas en 0044.
  if (nouvellesColonnes.some((x) => x.t === "reports" && x.col === "salon_message_id")) {
    ecrire("delete from study.reports where salon_message_id is not null;");
  }
  // Nouveautés d'un genre inconnu de 0044.
  const genreAvant = avant.contraintes.find((x) => x.t === "nouveautes" && x.nom === "nouveautes_genre_check");
  const genreApres = apres.contraintes.find((x) => x.t === "nouveautes" && x.nom === "nouveautes_genre_check");
  if (genreAvant && genreApres && genreAvant.def !== genreApres.def) {
    ecrire(`delete from study.nouveautes where not (${genreAvant.def.replace(/^CHECK \((.*)\)$/s, "$1")});`);
  }
  // Travaux de types introduits par 0048 et 0049 : le worker de 0044 ne les
  // connaît pas et les marquerait en échec. Ceux déjà terminés sont gardés.
  ecrire("delete from study_prive.jobs where kind in ('fiche_revision', 'recherche_indexer') and state in ('en_attente', 'en_cours', 'echoue');");
  ecrire("");

  // --- 2. Politiques nouvelles ou modifiées sur les tables d'avant -------------
  ecrire("-- 2. Politiques");
  const polAvant = new Map(avant.politiques.map((x) => [cle(x, "s", "t", "nom"), x]));
  const polApres = new Map(apres.politiques.map((x) => [cle(x, "s", "t", "nom"), x]));
  const politiqueSql = (p) =>
    `create policy ${q(p.nom)} on ${q(p.s)}.${q(p.t)} as ${p.permissive.toLowerCase()} for ${p.cmd.toLowerCase()} to ${p.roles.replace(/[{}]/g, "").split(",").map((r) => (r === "public" ? "public" : q(r))).join(", ")}` +
    (p.qual ? ` using (${p.qual})` : "") +
    (p.with_check ? ` with check (${p.with_check})` : "") +
    ";";
  const politiquesARecreer = [];
  for (const [k, p] of polApres) {
    if (!anciennes(p)) continue;
    const a = polAvant.get(k);
    if (!a) ecrire(`drop policy if exists ${q(p.nom)} on ${q(p.s)}.${q(p.t)};`);
    else if (JSON.stringify(a) !== JSON.stringify(p)) {
      ecrire(`drop policy if exists ${q(p.nom)} on ${q(p.s)}.${q(p.t)};`);
      politiquesARecreer.push(a);
    }
  }
  for (const [k, a] of polAvant) if (!polApres.has(k)) politiquesARecreer.push(a);
  ecrire("");

  // --- 3. Déclencheurs sur les tables d'avant ---------------------------------
  ecrire("-- 3. Declencheurs");
  const decAvant = new Map(avant.declencheurs.map((x) => [cle(x, "s", "t", "nom"), x]));
  const declencheursARecreer = [];
  for (const d of apres.declencheurs) {
    if (!anciennes(d)) continue;
    const a = decAvant.get(cle(d, "s", "t", "nom"));
    if (!a || a.def !== d.def) ecrire(`drop trigger if exists ${q(d.nom)} on ${q(d.s)}.${q(d.t)};`);
    if (a && a.def !== d.def) declencheursARecreer.push(a);
  }
  for (const a of avant.declencheurs) if (!apres.declencheurs.some((d) => cle(d, "s", "t", "nom") === cle(a, "s", "t", "nom"))) declencheursARecreer.push(a);
  ecrire("");

  // --- 4. Contraintes et index des tables d'avant ------------------------------
  ecrire("-- 4. Contraintes et index ajoutes ou modifies sur les tables d'avant");
  const conAvant = new Map(avant.contraintes.map((x) => [cle(x, "s", "t", "nom"), x]));
  const contraintesARecreer = [];
  // Les clés étrangères d'abord : une contrainte unique ne se retire pas tant
  // qu'une clé étrangère s'appuie dessus.
  const ordreCon = [...apres.contraintes].sort((a, b) => (a.ty === "f" ? 0 : 1) - (b.ty === "f" ? 0 : 1));
  for (const k of ordreCon) {
    if (!anciennes(k)) continue;
    const a = conAvant.get(cle(k, "s", "t", "nom"));
    if (!a || a.def !== k.def) ecrire(`alter table ${q(k.s)}.${q(k.t)} drop constraint if exists ${q(k.nom)} cascade;`);
    if (a && a.def !== k.def) contraintesARecreer.push(a);
  }
  for (const a of avant.contraintes) if (!apres.contraintes.some((k) => cle(k, "s", "t", "nom") === cle(a, "s", "t", "nom"))) contraintesARecreer.push(a);
  const idxAvant = new Map(avant.index.map((x) => [cle(x, "s", "nom"), x]));
  const indexARecreer = [];
  for (const i of apres.index) {
    if (!anciennes(i)) continue;
    const a = idxAvant.get(cle(i, "s", "nom"));
    if (!a || a.def !== i.def) ecrire(`drop index if exists ${q(i.s)}.${q(i.nom)};`);
    if (a && a.def !== i.def) indexARecreer.push(a);
  }
  for (const a of avant.index) if (!apres.index.some((i) => cle(i, "s", "nom") === cle(a, "s", "nom"))) indexARecreer.push(a);
  ecrire("");

  // --- 5. Tables, vues et séquences nouvelles ----------------------------------
  ecrire("-- 5. Tables, vues et sequences creees par 0045-0057 (PERTE DE DONNEES)");
  for (const t of nouvellesTables.filter((x) => x.k === "v" || x.k === "m")) ecrire(`drop view if exists ${q(t.s)}.${q(t.t)} cascade;`);
  for (const t of nouvellesTables.filter((x) => x.k === "r" || x.k === "p")) ecrire(`drop table if exists ${q(t.s)}.${q(t.t)} cascade;`);
  for (const t of nouvellesTables.filter((x) => x.k === "S")) ecrire(`drop sequence if exists ${q(t.s)}.${q(t.t)} cascade;`);
  ecrire("");

  // --- 6. Colonnes ajoutées aux tables d'avant ----------------------------------
  ecrire("-- 6. Colonnes ajoutees aux tables d'avant");
  for (const c of nouvellesColonnes) ecrire(`alter table ${q(c.s)}.${q(c.t)} drop column if exists ${q(c.col)} cascade;`);
  for (const c of avant.colonnes) {
    const n = apres.colonnes.find((x) => cle(x, "s", "t", "col") === cle(c, "s", "t", "col"));
    if (!n) non.push(`colonne supprimee : ${c.s}.${c.t}.${c.col}`);
    else if (n.ty !== c.ty) non.push(`type change : ${c.s}.${c.t}.${c.col}`);
  }
  ecrire("");

  // --- 7. Fonctions ----------------------------------------------------------
  ecrire("-- 7. Fonctions creees ou modifiees");
  const fAvant = new Map(avant.fonctions.map((x) => [cle(x, "s", "nom", "args"), x]));
  const fApres = new Map(apres.fonctions.map((x) => [cle(x, "s", "nom", "args"), x]));
  const fonctionsARestaurer = [];
  for (const [k, f] of fApres) {
    const a = fAvant.get(k);
    const genre = f.kind === "p" ? "procedure" : "function";
    if (!a) ecrire(`drop ${genre} if exists ${q(f.s)}.${q(f.nom)}(${f.args}) cascade;`);
    else if (a.def !== f.def || a.acl !== f.acl) {
      if (a.retour !== f.retour) ecrire(`drop ${genre} if exists ${q(f.s)}.${q(f.nom)}(${f.args}) cascade;`);
      fonctionsARestaurer.push(a);
    }
  }
  for (const [k, a] of fAvant) if (!fApres.has(k)) fonctionsARestaurer.push(a);
  ecrire("");

  // --- 8. Types ----------------------------------------------------------------
  ecrire("-- 8. Types");
  const tyAvant = new Map(avant.types.map((x) => [cle(x, "s", "nom"), x]));
  for (const t of apres.types) {
    const a = tyAvant.get(cle(t, "s", "nom"));
    if (!a) ecrire(`drop type if exists ${q(t.s)}.${q(t.nom)} cascade;`);
    else if (a.valeurs !== t.valeurs) non.push(`type modifie : ${t.s}.${t.nom}`);
  }
  ecrire("");

  // --- 9. Restauration de l'état 0044 ------------------------------------------
  ecrire("-- 9. Definitions 0044 restaurees (texte exact de pg_get_functiondef)");
  for (const f of fonctionsARestaurer) {
    ecrire(`${f.def.trim()};`);
  }
  ecrire("");
  ecrire("-- 10. Droits d'execution 0044");
  for (const f of fonctionsARestaurer) {
    const genre = f.kind === "p" ? "procedure" : "function";
    const cible = `${q(f.s)}.${q(f.nom)}(${f.args})`;
    ecrire(`revoke all on ${genre} ${cible} from public, anon, authenticated, service_role;`);
    for (const entree of f.acl === "" ? ["=X/postgres"] : f.acl.split(",")) {
      const [qui, droits] = entree.split("=");
      if (!/X/.test((droits ?? "").split("/")[0])) continue;
      ecrire(`grant execute on ${genre} ${cible} to ${qui === "" ? "public" : q(qui)};`);
    }
  }
  ecrire("");
  ecrire("-- 11. Contraintes, index, declencheurs et politiques 0044");
  // Unicité et clés primaires avant les clés étrangères qui s'y appuient.
  for (const k of contraintesARecreer.sort((a, b) => (a.ty === "f" ? 1 : 0) - (b.ty === "f" ? 1 : 0))) {
    ecrire(`alter table ${q(k.s)}.${q(k.t)} add constraint ${q(k.nom)} ${k.def};`);
  }
  for (const i of indexARecreer) ecrire(`${i.def};`);
  for (const d of declencheursARecreer) ecrire(`${d.def};`);
  for (const p of politiquesARecreer) ecrire(politiqueSql(p));
  ecrire("");

  // --- 12. Droits de table et RLS des tables d'avant ---------------------------
  ecrire("-- 12. Droits de table et RLS 0044");
  const dAvant = new Set(avant.droits.map((x) => cle(x, "s", "t", "g", "p")));
  const dApres = new Set(apres.droits.map((x) => cle(x, "s", "t", "g", "p")));
  for (const d of apres.droits) if (anciennes(d) && !dAvant.has(cle(d, "s", "t", "g", "p"))) ecrire(`revoke ${d.p.toLowerCase()} on ${q(d.s)}.${q(d.t)} from ${q(d.g)};`);
  for (const d of avant.droits) if (!dApres.has(cle(d, "s", "t", "g", "p"))) ecrire(`grant ${d.p.toLowerCase()} on ${q(d.s)}.${q(d.t)} to ${q(d.g)};`);
  for (const r of avant.rls) {
    const n = apres.rls.find((x) => cle(x, "s", "t") === cle(r, "s", "t"));
    if (n && (n.rls !== r.rls || n.force !== r.force)) {
      ecrire(`alter table ${q(r.s)}.${q(r.t)} ${r.rls ? "enable" : "disable"} row level security;`);
      ecrire(`alter table ${q(r.s)}.${q(r.t)} ${r.force ? "force" : "no force"} row level security;`);
    }
  }
  ecrire("", "commit;", "", "notify pgrst, 'reload schema';", "");

  if (non.length > 0) throw new Error("Differences non traitees :\n" + non.join("\n"));
  return out.join("\n");
}

if (process.argv[1] && path.resolve(process.argv[1]) === path.resolve(RACINE, "scripts", "engendrer-retour-arriere.mjs")) {
  const sql = await engendrer();
  const cible = path.join(RACINE, "supabase", "retour-arriere", "retour-0057-0045.sql");
  writeFileSync(cible, sql, "utf8");
  console.log(`Ecrit : ${path.relative(RACINE, cible)} (${sql.split("\n").length} lignes)`);
}
