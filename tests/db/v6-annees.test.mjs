// =============================================================================
// Study V7 — passage d'année scolaire (migration 0059, écran D05).
// Recette : droits (administration seulement, établissement propre), aperçu,
// refus d'une année sans classe, bascule idempotente, historique conservé.
// =============================================================================

import { test } from "node:test";
import assert from "node:assert/strict";
import { ACTEURS, OBJETS, baseDeTest, doitEchouer, lirePour, lirePourAdmin } from "./harness.mjs";

test("Passage d'année : préparer, prévoir, refuser une année vide, basculer une fois, ne rien supprimer", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());

  const refusProf = await doitEchouer(() => lirePour(db, ACTEURS.profMartin, "select study.annee_preparer('2027-2028', '2027-09-01', '2028-07-05')"));
  assert.match(refusProf.message, /NON_ACCESSIBLE/, "un professeur ne prépare pas l'année");

  const [{ annee_preparer: suivante }] = await lirePourAdmin(db, ACTEURS.adminA, "select study.annee_preparer('2027-2028', '2027-09-01', '2028-07-05')");
  const [{ annee_preparer: encore }] = await lirePourAdmin(db, ACTEURS.adminA, "select study.annee_preparer('2027-2028', '2027-09-01', '2028-07-05')");
  assert.equal(encore, suivante, "relancer ne duplique rien");

  const autre = await doitEchouer(() => lirePourAdmin(db, ACTEURS.adminB, "select * from study.annee_apercu($1)", [suivante]));
  assert.match(autre.message, /NON_ACCESSIBLE/, "un autre établissement ne voit pas cette année");

  const [apercu] = await lirePourAdmin(db, ACTEURS.adminA, "select * from study.annee_apercu($1)", [suivante]);
  assert.equal(apercu.annee_courante, "2026-2027");
  assert.equal(apercu.classes_cible, 0);
  assert.ok(apercu.inscriptions_a_clore > 0);

  const vide = await doitEchouer(() => lirePourAdmin(db, ACTEURS.adminA, "select study.annee_basculer($1)", [suivante]));
  assert.match(vide.message, /ANNEE_SANS_CLASSE/, "pas de bascule vers une année sans classe");

  await db.query("insert into study.classes (organization_id, academic_year_id, label, class_code) values ($1, $2, 'Première 1', 'P1')", [ACTEURS.lyceeA, suivante]);
  const inscriptionsAvant = (await db.query("select count(*)::int as n from study.class_enrollments")).rows[0].n;

  const [{ annee_basculer: fait }] = await lirePourAdmin(db, ACTEURS.adminA, "select study.annee_basculer($1)", [suivante]);
  assert.equal(fait, true);
  const [{ annee_basculer: rejeu }] = await lirePourAdmin(db, ACTEURS.adminA, "select study.annee_basculer($1)", [suivante]);
  assert.equal(rejeu, false, "relancée, la bascule ne fait rien");

  const annees = (await db.query("select label, is_current, archived_at is not null as archivee from study.academic_years where organization_id = $1 order by label", [ACTEURS.lyceeA])).rows;
  assert.deepEqual(annees.map((a) => [a.label, a.is_current, a.archivee]), [["2026-2027", false, true], ["2027-2028", true, false]]);
  assert.equal((await db.query("select count(*)::int as n from study.class_enrollments")).rows[0].n, inscriptionsAvant, "aucune inscription supprimée");
  const ouvertes = (await db.query("select count(*)::int as n from study.class_enrollments where class_id = $1 and ends_on is null", [OBJETS.classeA1])).rows[0].n;
  assert.equal(ouvertes, 0, "les inscriptions de l'année quittée sont closes, datées");
  assert.equal((await db.query("select archived_at is not null as a from study.classes where id = $1", [OBJETS.classeA1])).rows[0].a, true);
  const lyceeB = (await db.query("select is_current from study.academic_years where organization_id = $1", [ACTEURS.lyceeB])).rows;
  assert.deepEqual(lyceeB.map((a) => a.is_current), [true], "l'autre établissement n'est pas touché");
  assert.equal((await db.query("select count(*)::int as n from study.audit_events where action in ('annee_preparee', 'annee_basculee')")).rows[0].n, 2);
});
