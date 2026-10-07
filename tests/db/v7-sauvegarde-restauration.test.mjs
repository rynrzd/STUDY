// =============================================================================
// Sauvegarde et restauration — format 2 (scripts/sauvegarde-donnees.mjs).
//
// Une base migrée et utilisée est capturée comme le fait
// scripts/sauvegarde-production.mjs, puis restaurée dans une base neuve au
// même schéma : chaque ligne doit revenir à l'identique (horodatages à la
// microseconde, bytea, jsonb, tableaux), comptes Supabase Auth compris, et
// la connexion doit fonctionner sur la base restaurée.
// =============================================================================

import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { mkdtempSync, mkdirSync, writeFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { ACTEURS, baseDeTest, doitEchouer, lirePour } from "./harness.mjs";
import { capturerTable, empreinte, restaurer, tablesACapturer } from "../../scripts/sauvegarde-donnees.mjs";

// Équivalent minimal du schéma auth de Supabase : assez pour prouver que les
// comptes (empreinte de mot de passe, second facteur) font l'aller-retour.
const AUTH = `
  create schema if not exists auth;
  create table auth.users (id uuid primary key, email text, encrypted_password text, created_at timestamptz default clock_timestamp(), raw_app_meta_data jsonb);
  create table auth.identities (id uuid primary key, user_id uuid references auth.users(id), provider text, identity_data jsonb);
  create table auth.mfa_factors (id uuid primary key, user_id uuid references auth.users(id), factor_type text, secret text, created_at timestamptz default clock_timestamp());
`;

async function sauvegarder(db, dossier) {
  mkdirSync(path.join(dossier, "donnees"), { recursive: true });
  const manifeste = { horodatage: new Date().toISOString(), format: 2, comptes: true, fichiers: [], totaux: { tables: 0, lignes: 0 } };
  for (const { schema, table } of await tablesACapturer(db, { avecComptes: true })) {
    const texte = await capturerTable(db, schema, table);
    const fichier = `donnees/${schema}.${table}.json`;
    writeFileSync(path.join(dossier, fichier), texte, "utf8");
    const lignes = JSON.parse(texte).length;
    manifeste.fichiers.push({ fichier, lignes, sha256: empreinte(texte) });
    manifeste.totaux.lignes += lignes;
  }
  writeFileSync(path.join(dossier, "manifeste.json"), JSON.stringify(manifeste), "utf8");
  return manifeste;
}

test("une sauvegarde format 2 se restaure à l'identique, comptes compris, et la connexion fonctionne", async (t) => {
  const source = await baseDeTest();
  const cible = await baseDeTest({ seed: false });
  const dossier = mkdtempSync(path.join(tmpdir(), "study-sauvegarde-"));
  t.after(async () => {
    await source.close();
    await cible.close();
    rmSync(dossier, { recursive: true, force: true });
  });
  await source.exec(AUTH);
  await cible.exec(AUTH);

  // Activité réelle : bytea, microsecondes, messages, comptes.
  await source.query("select study.recuperation_demander('TESTA1', 'rayan.dupont', $1, 'K7M2-P9QX')", [createHash("sha256").update("ip").digest()]);
  const salon = (await source.query("select id from study.salons where class_id is not null and kind = 'general' limit 1")).rows[0].id;
  await lirePour(source, ACTEURS.eleveA1Rayan, "select * from study.salon_envoyer($1, $2, $3, null, 'message', null, null, false)", [salon, "Bonjour « la classe » \\n é", randomUUID()]);
  for (const id of [ACTEURS.eleveA1Rayan, ACTEURS.adminA]) {
    await source.query("insert into auth.users (id, email, encrypted_password, raw_app_meta_data) values ($1, $2, '$2a$10$abcdefghijklmnopqrstuv', '{\"provider\":\"email\"}')", [id, `${id}@alias.invalid`]);
    await source.query("insert into auth.identities (id, user_id, provider, identity_data) values ($1, $1, 'email', '{}')", [id]);
  }
  await source.query("insert into auth.mfa_factors (id, user_id, factor_type, secret) values ($1, $2, 'totp', 'SECRET')", [randomUUID(), ACTEURS.adminA]);

  const manifeste = await sauvegarder(source, dossier);
  assert.ok(manifeste.totaux.lignes > 50, "la sauvegarde porte des données");
  assert.ok(manifeste.fichiers.some((f) => f.fichier === "donnees/auth.users.json" && f.lignes === 2), "comptes capturés");

  const r = await restaurer(cible, dossier);
  for (const ligne of r.tables) {
    assert.equal(ligne.restaure, ligne.attendu, `${ligne.table} : compte`);
    assert.equal(ligne.ecarts, 0, `${ligne.table} : lignes identiques`);
  }

  // La base restaurée sert : résolution de connexion, salons, demande.
  assert.equal((await cible.query("select * from study.auth_resoudre_identifiant('TESTA1', 'rayan.dupont')")).rows.length, 1);
  assert.equal((await lirePour(cible, ACTEURS.eleveA1Rayan, "select id from study.mes_salons()")).length > 0, true);
  const [{ n }] = (await cible.query("select count(*)::int n from auth.mfa_factors")).rows;
  assert.equal(n, 1, "le second facteur de l'administrateur est restauré");
  // Les séquences reprennent après les valeurs restaurées.
  await cible.query("select study.recuperation_demander('TESTA1', 'lina.martin', $1, 'A1B2-C3D4')", [createHash("sha256").update("ip2").digest()]);
});

test("la restauration refuse une base cible non vide, et n'écrit rien si un fichier a été altéré", async (t) => {
  const source = await baseDeTest();
  const cible = await baseDeTest();
  const dossier = mkdtempSync(path.join(tmpdir(), "study-sauvegarde-"));
  t.after(async () => {
    await source.close();
    await cible.close();
    rmSync(dossier, { recursive: true, force: true });
  });
  // La cible porte une ligne que la sauvegarde n'a pas : elle serait écrasée.
  await cible.query("select study.recuperation_demander('TESTA1', 'rayan.dupont', $1, 'K7M2-P9QX')", [createHash("sha256").update("ip").digest()]);
  await sauvegarder(source, dossier);
  const pleine = await doitEchouer(() => restaurer(cible, dossier));
  assert.match(pleine.message, /n est pas vide/);

  writeFileSync(path.join(dossier, "donnees", "study.organizations.json"), "[]", "utf8");
  const vide = await baseDeTest({ seed: false });
  t.after(() => vide.close());
  const alteree = await doitEchouer(() => restaurer(vide, dossier));
  assert.match(alteree.message, /empreinte differente/);
  const [{ n }] = (await vide.query("select count(*)::int n from study.organizations")).rows;
  assert.equal(n, 0, "rien n'a été écrit");
});
