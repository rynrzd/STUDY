// =============================================================================
// Compatibilité de déploiement et de retour arrière — migrations 0058 et 0059.
//
// Trois questions, trois tests :
//  1. Migrer puis exécuter le script de retour rend-il la base d'avant ?
//     (définitions de fonctions comparées, données conservées)
//  2. L'ancien code fonctionne-t-il sur le nouveau schéma ? (retour du seul
//     code applicatif, base laissée migrée)
//  3. Le nouveau code fonctionne-t-il sur l'ancien schéma ? (déploiement du
//     code avant la migration) — non : l'ordre migration → code est obligatoire.
// =============================================================================

import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ACTEURS, appliquerMigrations, baseDeTest, doitEchouer, lirePourAdmin } from "./harness.mjs";

const ICI = path.dirname(fileURLToPath(import.meta.url));
const RETOUR = path.resolve(ICI, "..", "..", "supabase", "retour-arriere", "retour-0059-0058.sql");
const empreinte = (s) => createHash("sha256").update(s).digest();

const definitions = async (db) =>
  (
    await db.query(
      `select p.proname || '(' || pg_get_function_identity_arguments(p.oid) || ')' as sig, pg_get_functiondef(p.oid) as def
         from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'study' order by 1`,
    )
  ).rows;
const droits = async (db, noms) =>
  (
    await db.query(
      `select p.proname as nom, coalesce((select string_agg(a, ',' order by a) from unnest(p.proacl::text[]) a), '') as acl
         from pg_proc p join pg_namespace n on n.oid = p.pronamespace
        where n.nspname = 'study' and p.proname = any($1) order by 1`,
      [noms],
    )
  ).rows;
const colonnes = async (db, table) =>
  (await db.query("select column_name from information_schema.columns where table_schema = 'study' and table_name = $1 order by 1", [table])).rows.map((r) => r.column_name);

test("1 — migrer 0058/0059 puis exécuter le script de retour rend le schéma d'avant, sans perdre les demandes", async (t) => {
  const db = await baseDeTest({ jusqua: "0057" });
  t.after(() => db.close());
  const avant = await definitions(db);
  const droitsAvant = await droits(db, ["invitation_etat", "recuperation_demander", "recuperation_a_traiter"]);
  const colonnesAvant = await colonnes(db, "demandes_recuperation");

  await appliquerMigrations(db, { depuis: "0057" });
  await db.query("select study.recuperation_demander('TESTA1', 'rayan.dupont', $1, 'K7M2-P9QX')", [empreinte("ip")]);
  await lirePourAdmin(db, ACTEURS.adminA, "select study.annee_preparer('2027-2028', '2027-09-01', '2028-07-05')");
  assert.notDeepEqual(await definitions(db), avant, "la migration a bien changé le schéma");

  await db.exec(await readFile(RETOUR, "utf8"));

  const apres = await definitions(db);
  assert.deepEqual(apres.map((f) => f.sig), avant.map((f) => f.sig), "mêmes fonctions qu'avant la migration");
  for (const f of avant) {
    assert.equal(apres.find((x) => x.sig === f.sig)?.def, f.def, `définition identique : ${f.sig}`);
  }
  assert.deepEqual(await droits(db, ["invitation_etat", "recuperation_demander", "recuperation_a_traiter"]), droitsAvant, "mêmes droits d'exécution");
  assert.deepEqual(await colonnes(db, "demandes_recuperation"), colonnesAvant);
  const [{ n }] = (await db.query("select count(*)::int as n from study.demandes_recuperation")).rows;
  assert.equal(n, 1, "la demande enregistrée pendant la période migrée est conservée");
  const [{ n: annees }] = (await db.query("select count(*)::int as n from study.academic_years where label = '2027-2028'")).rows;
  assert.equal(annees, 1, "les données métier (année préparée) sont conservées");
});

test("2 — l'ancien code (avant 5d183b3) fonctionne sur le nouveau schéma", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());
  // Ancien appel de /acces-oublie : trois paramètres nommés.
  await db.query("select study.recuperation_demander(p_code => 'TESTA1', p_identifiant => 'rayan.dupont', p_empreinte => $1)", [empreinte("ip2")]);
  // Ancienne page /admin/recuperation : colonnes lues.
  const [ligne] = await lirePourAdmin(db, ACTEURS.adminA, "select * from study.recuperation_a_traiter()");
  for (const c of ["id", "prenom", "nom", "identifiant", "classe", "demandee_le"]) assert.ok(c in ligne, `colonne ${c} présente`);
  // Ancienne page d'invitation : colonnes lues ; un état inconnu d'elle (« indisponible ») tombe sur son repli « lien non reconnu ».
  await lirePourAdmin(db, ACTEURS.adminA, "select study.invitation_creer($1, $2)", [ACTEURS.eleveA1Lina, empreinte("lien")]);
  const [etat] = (await db.query("select * from study.invitation_etat($1)", [empreinte("lien")])).rows;
  for (const c of ["etat", "prenom", "organisation", "code_etablissement", "identifiant", "profile_id"]) assert.ok(c in etat, `colonne ${c} présente`);
  assert.equal(etat.etat, "valide");
  // Connexion : fonction inchangée par 0058/0059.
  assert.equal((await db.query("select * from study.auth_resoudre_identifiant('TESTA1', 'rayan.dupont')")).rows.length, 1);
});

test("3 — le nouveau code ne fonctionne pas sur l'ancien schéma : migrer avant de déployer le code", async (t) => {
  const db = await baseDeTest({ jusqua: "0057" });
  t.after(() => db.close());
  const decouverte = await doitEchouer(() => db.query("select * from study.etablissement_decouvrir('TESTA1', $1)", [empreinte("ip")]));
  assert.match(decouverte.message, /does not exist/, "sans 0058, l'étape « établissement » de la connexion échoue");
  const reference = await doitEchouer(() =>
    db.query("select study.recuperation_demander(p_code => 'TESTA1', p_identifiant => 'x', p_empreinte => $1, p_reference => 'K7M2-P9QX')", [empreinte("ip")]),
  );
  assert.match(reference.message, /does not exist/, "sans 0058, la demande de récupération du nouveau code échoue");
});
