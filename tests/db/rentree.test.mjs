// =============================================================================
// 0073 — Rentrée (cahier des charges ch. 18). À la bascule, les groupes et les
// cours de l'année quittée ferment comme les classes ; les groupes se
// reconduisent sans leurs élèves, avec leurs cours et professeurs en option.
// =============================================================================

import { test } from "node:test";
import assert from "node:assert/strict";
import { ACTEURS, OBJETS, baseDeTest, doitEchouer, enTantQue, lirePour, lirePourAdmin } from "./harness.mjs";

const GROUPE = "aaaaaaaa-3333-4000-8000-000000000003";

async function preparer(db) {
  const [{ annee_preparer: annee }] = await lirePourAdmin(db, ACTEURS.adminA, "select study.annee_preparer('2027-2028', current_date - 1, current_date + 300)");
  const [{ annee_creer_classe: c1 }] = await lirePourAdmin(db, ACTEURS.adminA, "select study.annee_creer_classe($1, 'Première 1')", [annee]);
  const [{ annee_creer_classe: c2 }] = await lirePourAdmin(db, ACTEURS.adminA, "select study.annee_creer_classe($1, 'Première 2')", [annee]);
  await lirePourAdmin(db, ACTEURS.adminA, "select study.annee_preinscrire_classe($1, $2)", [OBJETS.classeA1, c1]);
  await lirePourAdmin(db, ACTEURS.adminA, "select study.annee_preinscrire_classe($1, $2)", [OBJETS.classeA2, c2]);
  return annee;
}
const basculer = (db, annee) => lirePourAdmin(db, ACTEURS.adminA, "select study.annee_basculer($1, true)", [annee]);
async function role(db, profil, sql, params) {
  return enTantQue(db, profil, async () => (await db.query(sql, params)).rows[0]);
}

test("REN-01 — la bascule ferme aussi les groupes et les cours de l'année quittée", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());
  const annee = await preparer(db);
  assert.equal((await role(db, ACTEURS.eleveA1Rayan, "select study.attends_space($1) as v", [OBJETS.espaceSpecialite])).v, true, "avant : Rayan suit sa spécialité");

  await basculer(db, annee);

  assert.equal((await role(db, ACTEURS.eleveA1Rayan, "select study.attends_space($1) as v", [OBJETS.espaceSpecialite])).v, false, "après : plus d'accès à la spécialité de l'an dernier");
  const g = (await db.query("select archived_at is not null as archive from study.teaching_groups where id = $1", [GROUPE])).rows[0];
  assert.equal(g.archive, true);
  const espaces = (await db.query("select count(*)::int n from study.teaching_spaces where id = any($1) and archived_at is null", [[OBJETS.espaceMathsA1, OBJETS.espaceMathsA2, OBJETS.espaceSpecialite]])).rows[0].n;
  assert.equal(espaces, 0, "les cours de l'an dernier sont archivés");
  assert.equal((await db.query("select count(*)::int n from study.group_memberships where group_id = $1", [GROUPE])).rows[0].n, 2, "rien n'est supprimé");

  // Plus de publication dans un cours de l'an dernier.
  const studio = await lirePour(db, ACTEURS.profMartin, "select id from study.teaching_spaces where archived_at is null", []);
  assert.ok(!studio.some((x) => x.id === OBJETS.espaceMathsA1), "le cours de l'an dernier n'est plus listé comme actif");
});

test("REN-02 — reconduire un groupe : même nom, aucun élève, cours et professeur en option", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());
  const annee = await preparer(db);

  const avant = await lirePourAdmin(db, ACTEURS.adminA, "select * from study.annee_groupes_a_reconduire($1)", [annee]);
  const spe = avant.find((x) => x.groupe === GROUPE);
  assert.equal(spe.effectif, 2);
  assert.equal(spe.deja_reconduit, false);

  const [r] = await lirePourAdmin(db, ACTEURS.adminA, "select * from study.annee_reconduire_groupes($1, $2, true)", [annee, [GROUPE]]);
  assert.equal(r.resultat, "cree");
  assert.equal(r.cours_reconduits, 1);
  assert.equal((await db.query("select count(*)::int n from study.group_memberships where group_id = $1", [r.nouveau])).rows[0].n, 0, "jamais les élèves");

  const espace = (await db.query("select id from study.teaching_spaces where group_id = $1 and academic_year_id = $2", [r.nouveau, annee])).rows[0].id;
  const prof = (await db.query("select profile_id, role_in_space, starts_on = (select starts_on from study.academic_years where id = $2) as a_la_rentree from study.teacher_assignments where teaching_space_id = $1", [espace, annee])).rows;
  assert.deepEqual(prof.map((p) => [p.profile_id, p.role_in_space, p.a_la_rentree]), [[ACTEURS.profMartin, "titulaire", true]]);

  const [rejeu] = await lirePourAdmin(db, ACTEURS.adminA, "select * from study.annee_reconduire_groupes($1, $2, true)", [annee, [GROUPE]]);
  assert.equal(rejeu.resultat, "existant");
  assert.equal(rejeu.nouveau, r.nouveau);
  assert.equal(rejeu.cours_reconduits, 0, "rejouer ne crée rien");
  assert.equal((await lirePourAdmin(db, ACTEURS.adminA, "select * from study.annee_groupes_a_reconduire($1)", [annee])).find((x) => x.groupe === GROUPE).deja_reconduit, true);

  await basculer(db, annee);
  assert.equal((await db.query("select archived_at is null as actif from study.teaching_groups where id = $1", [r.nouveau])).rows[0].actif, true, "le groupe reconduit vit dans la nouvelle année");
});

test("REN-03 — un remplaçant n'est pas reconduit", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());
  await db.query("insert into study.teacher_assignments (organization_id, teaching_space_id, profile_id, role_in_space, starts_on, ends_on) values ($1, $2, $3, 'remplacant', current_date - 2, current_date + 10)", [ACTEURS.lyceeA, OBJETS.espaceSpecialite, ACTEURS.profAutre]);
  const annee = await preparer(db);
  const [r] = await lirePourAdmin(db, ACTEURS.adminA, "select * from study.annee_reconduire_groupes($1, $2, true)", [annee, [GROUPE]]);
  const profs = (await db.query("select a.profile_id from study.teacher_assignments a join study.teaching_spaces ts on ts.id = a.teaching_space_id where ts.group_id = $1", [r.nouveau])).rows.map((x) => x.profile_id);
  assert.deepEqual(profs, [ACTEURS.profMartin]);
});

test("REN-04 — réservé à l'administration avec second facteur", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());
  const annee = await preparer(db);
  assert.match((await doitEchouer(() => lirePour(db, ACTEURS.profMartin, "select * from study.annee_reconduire_groupes($1, $2)", [annee, [GROUPE]]))).message, /NON_ACCESSIBLE/);
  assert.match((await doitEchouer(() => lirePour(db, ACTEURS.adminA, "select * from study.annee_groupes_a_reconduire($1)", [annee]))).message, /NON_ACCESSIBLE/, "sans second facteur");
  assert.match((await doitEchouer(() => lirePourAdmin(db, ACTEURS.adminB, "select * from study.annee_groupes_a_reconduire($1)", [annee]))).message, /NON_ACCESSIBLE/, "l'admin du lycée B");
  for (const f of ["study.annee_groupes_a_reconduire(uuid)", "study.annee_reconduire_groupes(uuid, uuid[], boolean)"]) {
    assert.equal((await db.query("select has_function_privilege('anon', $1, 'execute') as ok", [f])).rows[0].ok, false);
  }
});
