// Répétition des scripts réels du dépôt contre PostgreSQL 17 local :
// npm run sauvegarde -- --avec-comptes, puis --verifier, puis
// scripts/restaurer-sauvegarde.mjs --creer-comptes dans une base de recette
// sans schéma auth ; enfin le garde-fou « cible = base sauvegardée ».
//
//   node scripts/recette-locale/repetition-scripts.mjs

import { readFileSync, rmSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import path from "node:path";
import { DEPOT, client, migrer as migrerDe, url } from "./environnement.mjs";
const resultats = [];
const dire = (ok, t) => { resultats.push({ ok, t }); console.log(`${ok ? "  ok " : "  NON"} ${t}`); };
const migrer = (c, a) => migrerDe(c, "0000", a);

// Schéma auth proche de Supabase : types énumérés, colonnes nombreuses.
const AUTH = `
  create schema auth;
  create type auth.factor_type as enum ('totp', 'webauthn', 'phone');
  create type auth.factor_status as enum ('unverified', 'verified');
  create table auth.users (instance_id uuid, id uuid primary key, aud varchar(255), role varchar(255), email varchar(255), encrypted_password varchar(255),
    email_confirmed_at timestamptz, raw_app_meta_data jsonb, raw_user_meta_data jsonb, is_super_admin boolean, created_at timestamptz, updated_at timestamptz,
    banned_until timestamptz, is_anonymous boolean not null default false);
  create table auth.identities (provider_id text not null, user_id uuid not null references auth.users(id), identity_data jsonb not null, provider text not null,
    last_sign_in_at timestamptz, created_at timestamptz, updated_at timestamptz, id uuid primary key default gen_random_uuid());
  create table auth.mfa_factors (id uuid primary key, user_id uuid not null references auth.users(id), friendly_name text, factor_type auth.factor_type not null,
    status auth.factor_status not null, created_at timestamptz not null, updated_at timestamptz not null, secret text);`;

const admin = await client("postgres");
for (const b of ["prod_cli", "recette_cli"]) await admin.query(`drop database if exists ${b} with (force)`);
await admin.query("create database prod_cli");
await admin.query("create database recette_cli");
const prod = await client("prod_cli");
await prod.query(AUTH);
await migrer(prod, "0044");
await prod.query(readFileSync(path.join(DEPOT, "supabase", "seed", "seed_recette.sql"), "utf8"));
for (const { id } of (await prod.query("select id from study.profiles")).rows) {
  await prod.query(`insert into auth.users (id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, created_at, updated_at)
    values ($1, 'authenticated', 'authenticated', $2, '$2a$10$fictiffictiffictiffictiu', clock_timestamp(), '{"provider":"email"}', clock_timestamp(), clock_timestamp())`, [id, `${id}@alias.invalid`]);
  await prod.query("insert into auth.identities (provider_id, user_id, identity_data, provider, created_at) values ($1::text, $2::uuid, '{}', 'email', clock_timestamp())", [id, id]);
}
await prod.query("insert into auth.mfa_factors values ($1, 'aaaaaaaa-1111-4000-8000-000000000001', 'tel', 'totp', 'verified', clock_timestamp(), clock_timestamp(), 'FICTIF')", [randomUUID()]);
await prod.end();
const rec = await client("recette_cli");
await migrer(rec, "0044");
await rec.end();

const lancer = (args, env) => spawnSync(process.execPath, args, { cwd: DEPOT, env: { ...process.env, ...env }, encoding: "utf8" });

console.log("1. npm run sauvegarde -- --avec-comptes (base locale prod_cli)");
const s = lancer(["scripts/sauvegarde-production.mjs", "--avec-comptes"], { WORKER_DATABASE_URL: url("prod_cli") });
const dossier = (s.stdout.match(/Sauvegarde ecrite : (\S+)/) ?? [])[1];
dire(s.status === 0 && Boolean(dossier), `sauvegarde ecrite : ${dossier} ${s.status !== 0 ? s.stderr.slice(-400) : ""}`);
const acl = spawnSync("icacls", [path.join(DEPOT, dossier)], { encoding: "utf8" }).stdout;
const entrees = acl.replace(path.join(DEPOT, dossier), "").split(/\r?\n/).map((l) => l.trim()).filter((l) => /:\(/.test(l));
dire(entrees.length === 1 && entrees[0].includes(`\\${process.env.USERNAME}:`), `acces au dossier restreint : ${acl.split("\n").slice(0, 3).join(" ").replace(/\s+/g, " ").trim()}`);

console.log("2. --verifier");
const v = lancer(["scripts/sauvegarde-production.mjs", "--verifier", path.basename(dossier)], { WORKER_DATABASE_URL: url("prod_cli") });
dire(v.status === 0, "sauvegarde verifiee contre la base vivante" + (v.status ? " — " + v.stdout.slice(-400) : ""));

console.log("3. Restauration en recette, structure auth recreee");
const r = lancer(["scripts/restaurer-sauvegarde.mjs", path.basename(dossier), "--creer-comptes"], { RESTAURE_DATABASE_URL: url("recette_cli"), WORKER_DATABASE_URL: url("prod_cli") });
console.log(r.stdout.split("\n").filter((l) => /lignes|ecart|Structure|Niveau|annulee/i.test(l)).map((l) => "     " + l).join("\n"));
dire(r.status === 0 && /0 ecart/.test(r.stdout), "restauration exacte, comptes compris" + (r.status ? " — " + (r.stderr || r.stdout).slice(-400) : ""));

console.log("4. Garde-fou : la cible ne peut pas etre la base sauvegardee");
const g = lancer(["scripts/restaurer-sauvegarde.mjs", path.basename(dossier)], { RESTAURE_DATABASE_URL: url("prod_cli"), WORKER_DATABASE_URL: url("prod_cli") });
dire(g.status === 1 && /Refus/.test(g.stderr), "refus de restaurer sur la base source");
const ref = "fauxrefprod";
const g2 = lancer(["scripts/restaurer-sauvegarde.mjs", path.basename(dossier)], { RESTAURE_DATABASE_URL: `postgres://postgres.${ref}:x@aws-0-eu-west-3.pooler.supabase.com:5432/postgres`, WORKER_DATABASE_URL: url("prod_cli"), SUPABASE_URL: `https://${ref}.supabase.co` });
dire(g2.status === 1 && /Refus/.test(g2.stderr), "refus d'une adresse portant la reference du projet de production (aucune connexion tentee)");

const c = await client("recette_cli");
const [{ n }] = (await c.query("select count(*)::int n from auth.mfa_factors where factor_type = 'totp' and status = 'verified'")).rows;
dire(n === 1, "second facteur restaure avec ses types enumeres");
await c.end();
await admin.end();
rmSync(path.join(DEPOT, dossier), { recursive: true, force: true });
console.log(`\n${resultats.filter((x) => x.ok).length}/${resultats.length} verifications reussies (dossier de repetition supprime).`);
process.exitCode = resultats.every((x) => x.ok) ? 0 : 1;
