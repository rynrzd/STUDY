import test from "node:test";
import assert from "node:assert/strict";
import { ACTEURS, OBJETS, baseDeTest, lirePour, doitEchouer } from "./harness.mjs";
import { preparerRevisionLina } from "./fixtures-reviser.mjs";
import { randomUUID } from "node:crypto";

test("Réviser — notions, publication rejouée et isolation de deux classes proches", async t => {
  const db = await baseDeTest();
  t.after(() => db.close());
  await db.query("update study.classes set label = '1re STMG 2' where id = $1", [OBJETS.classeA1]);
  await db.query("update study.classes set label = '1re STMG 3' where id = $1", [OBJETS.classeA2]);
  const notion = (await lirePour(db, ACTEURS.profMartin,
    "insert into study.notions (organization_id, teaching_space_id, label, created_by) values ($1,$2,$3,$4) returning id",
    [ACTEURS.lyceeA, OBJETS.espaceMathsA1, "Charges fixes et variables", ACTEURS.profMartin]))[0].id;
  await lirePour(db, ACTEURS.profMartin,
    "update study.assignments set state = 'brouillon', revision_notions = array[$2::uuid] where id = $1",
    [OBJETS.devoirA1, notion]);
  assert.equal((await lirePour(db, ACTEURS.eleveA1Lina, "select * from study.reviser_devoirs()")).length, 0);
  await lirePour(db, ACTEURS.profMartin, "select study.devoir_publier_revision($1)", [OBJETS.devoirA1]);
  const premier = await db.query("select count(*) from study.assignment_recipients where assignment_id = $1", [OBJETS.devoirA1]);
  await lirePour(db, ACTEURS.profMartin, "select study.devoir_publier_revision($1)", [OBJETS.devoirA1]);
  const second = await db.query("select count(*) from study.assignment_recipients where assignment_id = $1", [OBJETS.devoirA1]);
  assert.deepEqual(second.rows, premier.rows);
  const lina = await lirePour(db, ACTEURS.eleveA1Lina, "select * from study.reviser_devoirs()");
  assert.equal(lina[0].notion_id, notion);
  await lirePour(db, ACTEURS.profMartin,
    "update study.assignments set revision_notions = '{}' where id = $1", [OBJETS.devoirA1]);
  assert.equal((await lirePour(db, ACTEURS.eleveA1Lina, "select * from study.reviser_devoirs()")).length, 0);
  await lirePour(db, ACTEURS.profMartin,
    "update study.assignments set revision_notions = array[$2::uuid] where id = $1", [OBJETS.devoirA1, notion]);
  await db.query("update study.academic_years set is_current = false");
  assert.equal((await lirePour(db, ACTEURS.eleveA1Lina, "select * from study.reviser_devoirs()")).length, 0);
  await db.query("update study.academic_years set is_current = true where id = (select academic_year_id from study.teaching_spaces where id = $1)", [OBJETS.espaceMathsA1]);
  assert.equal((await lirePour(db, ACTEURS.eleveA2Samir, "select * from study.reviser_devoirs()")).length, 0);
  assert.equal((await lirePour(db, ACTEURS.eleveA2Samir, "select id from study.assignments where id = $1", [OBJETS.devoirA1])).length, 0);
  await doitEchouer(() => lirePour(db, ACTEURS.eleveA2Samir, "select study.devoir_publier_revision($1)", [OBJETS.devoirA1]));
  await lirePour(db, ACTEURS.profMartin, "update study.assignments set archived_at = now() where id = $1", [OBJETS.devoirA1]);
  assert.equal((await lirePour(db, ACTEURS.eleveA1Lina, "select * from study.reviser_devoirs()")).length, 0);
});

test("Réviser — erreur expliquée, nouvelle tâche, curseur persistant et retrait d'accès", async t => {
  const db = await baseDeTest();
  t.after(() => db.close());
  const { versions } = await preparerRevisionLina(db);
  const session = (await lirePour(db, ACTEURS.eleveA1Lina,
    "select study.entrainement_ouvrir('Charges', $1) as id", [versions]))[0].id;
  const cle = randomUUID();
  const parametres = [versions[0], JSON.stringify({ index: 0 }), cle, session];
  const correction = (await lirePour(db, ACTEURS.eleveA1Lina,
    "select * from study.revision_tenter($1,$2,$3,$4)", parametres))[0];
  assert.equal(correction.correct, false);
  assert.match(correction.explication, /loyer reste fixe/);
  const rejouee = (await lirePour(db, ACTEURS.eleveA1Lina,
    "select * from study.revision_tenter($1,$2,$3,$4)", parametres))[0];
  assert.equal(rejouee.rejouee, true);
  assert.equal((await lirePour(db, ACTEURS.eleveA1Lina,
    "select position_courante from study.sessions_entrainement where id = $1", [session]))[0].position_courante, 0);
  await lirePour(db, ACTEURS.eleveA1Lina, "select study.reviser_avancer($1,0)", [session]);
  await lirePour(db, ACTEURS.eleveA1Lina, "select study.reviser_avancer($1,0)", [session]);
  const etat = await lirePour(db, ACTEURS.eleveA1Lina, "select * from study.entrainement_etat($1)", [session]);
  assert.equal(etat[1].kind, "numerique");
  assert.match(etat[1].enonce, /atelier/);
  assert.equal(etat[0].reponse.index, 0);
  assert.equal((await lirePour(db, ACTEURS.eleveA1Lina,
    "select position_courante from study.sessions_entrainement where id = $1", [session]))[0].position_courante, 1);
  assert.equal((await lirePour(db, ACTEURS.eleveA2Samir, "select * from study.entrainement_etat($1)", [session])).length, 0);
  await doitEchouer(() => lirePour(db, ACTEURS.eleveA2Samir, "select study.reviser_avancer($1,1)", [session]));
  await db.query("delete from study.class_enrollments where profile_id = $1", [ACTEURS.eleveA1Lina]);
  assert.equal((await lirePour(db, ACTEURS.eleveA1Lina, "select * from study.entrainement_etat($1)", [session])).length, 0);
  await doitEchouer(() => lirePour(db, ACTEURS.eleveA1Lina, "select study.reviser_avancer($1,1)", [session]));
});
