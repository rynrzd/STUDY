// =============================================================================
// Plan de récupération — retour complet de 0060 à 0044.
//
// Exécute, dans l'ordre, retour-0060.sql, retour-0059-0058.sql et
// retour-0057-0045.sql sur une base migrée puis utilisée, et vérifie :
//  1. que le catalogue (tables, colonnes, contraintes, index, politiques,
//     déclencheurs, fonctions et leurs droits, types, droits de table, RLS)
//     redevient exactement celui de 0044 ;
//  2. que les lignes des tables existant en 0044 sont conservées, à
//     l'exception documentée de celles qui ne peuvent pas exister en 0044 ;
//  3. que le script engendré versionné correspond au générateur (pas de
//     dérive entre le fichier relu et le code qui le produit).
// =============================================================================

import { test } from "node:test";
import assert from "node:assert/strict";
import { createHash, randomUUID } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { ACTEURS, appliquerMigrations, baseDeTest, lirePour, lirePourAdmin } from "./harness.mjs";
import { engendrer, lireCatalogue } from "../../scripts/engendrer-retour-arriere.mjs";

const ICI = path.dirname(fileURLToPath(import.meta.url));
const RETOUR = (f) => path.resolve(ICI, "..", "..", "supabase", "retour-arriere", f);
const ORDRE = ["retour-0060.sql", "retour-0059-0058.sql", "retour-0057-0045.sql"];
const empreinte = (s) => createHash("sha256").update(s).digest();

/** Empreinte du contenu de chaque table existant en 0044, ligne par ligne. */
async function contenu(db, tables) {
  const res = {};
  for (const { s, t } of tables) {
    const { rows } = await db.query(`select coalesce(string_agg(x::text, E'\\n' order by x::text), '') as v from "${s}"."${t}" x`);
    res[`${s}.${t}`] = createHash("sha256").update(rows[0].v).digest("hex");
  }
  return res;
}

test("le script versionné est celui que produit le générateur", async () => {
  assert.equal(await readFile(RETOUR("retour-0057-0045.sql"), "utf8"), await engendrer());
});

test("retour complet 0060 → 0044 : catalogue identique, données d'avant conservées", async (t) => {
  const db = await baseDeTest({ jusqua: "0044" });
  t.after(() => db.close());
  const catalogueAvant = await lireCatalogue(db);
  const tablesAvant = catalogueAvant.tables.filter((x) => x.k === "r");
  const contenuAvant = await contenu(db, tablesAvant);
  const signalementsAvant = (await db.query("select count(*)::int n from study.reports")).rows[0].n;

  await appliquerMigrations(db, { depuis: "0044" });

  // Activité pendant la période migrée, sur des tables anciennes et nouvelles.
  const salon = (await db.query("select id from study.salons where class_id is not null and kind = 'general' limit 1")).rows[0].id;
  const [message] = await lirePour(db, ACTEURS.eleveA1Rayan, "select * from study.salon_envoyer($1, $2, $3, null, 'message', null, null, false)", [salon, "Bonjour la classe", randomUUID()]);
  await lirePour(db, ACTEURS.eleveA1Lina, "insert into study.reports (organization_id, reporter_id, salon_message_id, reason) values ($1, $2, $3, 'autre')", [ACTEURS.lyceeA, ACTEURS.eleveA1Lina, message.id]);
  await db.query("select study.recuperation_demander('TESTA1', 'rayan.dupont', $1, 'K7M2-P9QX')", [empreinte("ip")]);
  await lirePourAdmin(db, ACTEURS.adminA, "select study.annee_preparer('2027-2028', '2027-09-01', '2028-07-05')");
  assert.equal((await db.query("select count(*)::int n from study.reports where salon_message_id is not null")).rows[0].n, 1);

  for (const f of ORDRE) await db.exec(await readFile(RETOUR(f), "utf8"));

  const catalogueApres = await lireCatalogue(db);
  for (const partie of Object.keys(catalogueAvant)) {
    assert.deepEqual(catalogueApres[partie], catalogueAvant[partie], `catalogue identique à 0044 : ${partie}`);
  }

  // Données : seules les tables qui ont reçu l'activité ci-dessus diffèrent,
  // par ajout ; aucune ligne d'avant n'a disparu ni changé.
  const contenuApres = await contenu(db, tablesAvant);
  const changees = Object.keys(contenuAvant).filter((k) => contenuAvant[k] !== contenuApres[k]).sort();
  const attendues = ["study.academic_years", "study.audit_events"];
  assert.equal((await db.query("select count(*)::int n from study_prive.jobs where kind in ('fiche_revision', 'recherche_indexer')")).rows[0].n, 0, "aucun travail inconnu du worker de 0044 ne reste en file");
  assert.deepEqual(changees.filter((k) => !attendues.includes(k)), [], "aucune autre table d'avant n'a changé");
  assert.equal((await db.query("select count(*)::int n from study.academic_years where label = '2027-2028'")).rows[0].n, 1, "l'année préparée est conservée");
  // demandes_recuperation est créée par 0054 : un retour complet la supprime (perte documentée).
  assert.equal((await db.query("select to_regclass('study.demandes_recuperation') is null as absente")).rows[0].absente, true);
  assert.equal((await db.query("select count(*)::int n from study.reports")).rows[0].n, signalementsAvant, "le signalement d'un message de salon disparaît avec sa cible ; les autres restent");

  // Le code de 0044 fonctionne : connexion et lecture d'un élève.
  assert.equal((await db.query("select * from study.auth_resoudre_identifiant('TESTA1', 'rayan.dupont')")).rows.length, 1);
});
