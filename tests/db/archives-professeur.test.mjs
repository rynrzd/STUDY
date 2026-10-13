// =============================================================================
// 0076 — Archives du professeur (cahier des charges ch. 18 : YR-05, YR-07,
// YR-09 ; ch. 16 : PED-03). Un cours archivé n'est plus modifiable, même en
// base ; son titulaire le relit et peut en réutiliser les séances cette année.
// =============================================================================

import { test } from "node:test";
import assert from "node:assert/strict";
import { ACTEURS, OBJETS, baseDeTest, doitEchouer, lirePour, lirePourAdmin } from "./harness.mjs";

const GROUPE = "aaaaaaaa-3333-4000-8000-000000000003";

async function basculer(db) {
  const [{ annee_preparer: annee }] = await lirePourAdmin(db, ACTEURS.adminA, "select study.annee_preparer('2027-2028', current_date - 1, current_date + 300)");
  const [{ annee_creer_classe: c1 }] = await lirePourAdmin(db, ACTEURS.adminA, "select study.annee_creer_classe($1, 'Première 1')", [annee]);
  await lirePourAdmin(db, ACTEURS.adminA, "select study.annee_preinscrire_classe($1, $2)", [OBJETS.classeA1, c1]);
  // Le groupe de spécialité continue : son cours et son professeur sont reconduits.
  const [r] = await lirePourAdmin(db, ACTEURS.adminA, "select * from study.annee_reconduire_groupes($1, $2, true)", [annee, [GROUPE]]);
  await lirePourAdmin(db, ACTEURS.adminA, "select study.annee_basculer($1, true)", [annee]);
  const nouveau = (await db.query("select id from study.teaching_spaces where group_id = $1", [r.nouveau])).rows[0].id;
  return { annee, nouveau };
}

test("ARCP-01 — un cours archivé n'est plus modifiable par son professeur, même en base", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());
  const avant = await lirePour(db, ACTEURS.profMartin, "select study.teaches_space($1) as v", [OBJETS.espaceMathsA1]);
  assert.equal(avant[0].v, true);

  await basculer(db);

  const apres = await lirePour(db, ACTEURS.profMartin, "select study.teaches_space($1) as v", [OBJETS.espaceMathsA1]);
  assert.equal(apres[0].v, false, "YR-05 : plus de cours actif l'an d'après");
  await doitEchouer(() =>
    lirePour(
      db,
      ACTEURS.profMartin,
      "insert into study.lessons (organization_id, teaching_space_id, title, created_by) values ($1, $2, 'Ajout tardif', $3)",
      [ACTEURS.lyceeA, OBJETS.espaceMathsA1, ACTEURS.profMartin],
    ),
  );
  const modifiees = await lirePour(db, ACTEURS.profMartin, "update study.lessons set title = 'Retouche' where id = $1 returning id", [OBJETS.seanceA1]);
  assert.equal(modifiees.length, 0, "aucune ligne d'un cours archivé ne se modifie");
});

test("ARCP-02 — le titulaire relit ses cours archivés : séances, devoirs, sans nom d'élève", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());
  await basculer(db);

  const liste = await lirePour(db, ACTEURS.profMartin, "select * from study.prof_cours_archives()");
  assert.ok(liste.some((c) => c.espace === OBJETS.espaceMathsA1), "son cours de l'an dernier est listé");
  assert.ok(liste.every((c) => c.annee), "chaque cours dit son année");

  const [{ r }] = await lirePour(db, ACTEURS.profMartin, "select study.prof_archive_cours($1) as r", [OBJETS.espaceMathsA1]);
  assert.ok(r.seances.some((s) => s.id === OBJETS.seanceA1));
  assert.ok(r.devoirs.some((d) => d.id === OBJETS.devoirA1));
  const noms = (await db.query("select last_name from study.profiles where id = any($1)", [[ACTEURS.eleveA1Rayan, ACTEURS.eleveA1Lina]])).rows.map((x) => x.last_name);
  for (const n of noms) assert.ok(!JSON.stringify(r).includes(n), "aucun nom d'élève");

  const [{ s }] = await lirePour(db, ACTEURS.profMartin, "select study.prof_archive_seance($1) as s", [OBJETS.seanceA1]);
  assert.equal(s.seance.id, OBJETS.seanceA1);
  assert.ok(Array.isArray(s.blocs));
});

test("ARCP-03 — ni un collègue, ni un remplaçant, ni un autre lycée, ni un cours encore actif", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());
  await db.query(
    "insert into study.teacher_assignments (organization_id, teaching_space_id, profile_id, role_in_space, starts_on, ends_on) values ($1, $2, $3, 'remplacant', current_date - 5, current_date + 5)",
    [ACTEURS.lyceeA, OBJETS.espaceMathsA1, ACTEURS.profAutre],
  );
  // Un cours encore actif ne passe pas par la voie des archives.
  assert.match((await doitEchouer(() => lirePour(db, ACTEURS.profMartin, "select study.prof_archive_cours($1)", [OBJETS.espaceMathsA1]))).message, /NON_ACCESSIBLE/);

  await basculer(db);
  assert.match((await doitEchouer(() => lirePour(db, ACTEURS.profAutre, "select study.prof_archive_cours($1)", [OBJETS.espaceMathsA1]))).message, /NON_ACCESSIBLE/, "le remplaçant");
  assert.match((await doitEchouer(() => lirePour(db, ACTEURS.profAutre, "select study.prof_archive_seance($1)", [OBJETS.seanceA1]))).message, /NON_ACCESSIBLE/);
  assert.equal((await lirePour(db, ACTEURS.profAutre, "select * from study.prof_cours_archives()")).length, 0);
  assert.match((await doitEchouer(() => lirePour(db, ACTEURS.eleveA1Rayan, "select study.prof_archive_seance($1)", [OBJETS.seanceA1]))).message, /NON_ACCESSIBLE/, "un élève");
  assert.match((await doitEchouer(() => lirePour(db, ACTEURS.adminB, "select study.prof_archive_cours($1)", [OBJETS.espaceMathsA1]))).message, /NON_ACCESSIBLE/);
  for (const f of ["study.prof_cours_archives()", "study.prof_archive_cours(uuid)", "study.prof_archive_seance(uuid)", "study.enseignait_archive(uuid)"]) {
    assert.equal((await db.query("select has_function_privilege('anon', $1, 'execute') as ok", [f])).rows[0].ok, false, f);
  }
  assert.equal((await db.query("select has_function_privilege('authenticated', 'study.enseignait_archive(uuid)', 'execute') as ok")).rows[0].ok, false, "aide interne, non appelable");
});

test("ARCP-04 — réutiliser une séance de l'an dernier dans un cours de cette année (YR-07)", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());
  const ancienne = (await db.query("select id from study.lessons where teaching_space_id = $1 and archived_at is null limit 1", [OBJETS.espaceSpecialite])).rows[0]?.id ?? OBJETS.seanceA1;
  const { nouveau } = await basculer(db);

  const [copie] = (await db.query("select * from study.studio_dupliquer_seance($1, $2, $3, null)", [ACTEURS.profMartin, ancienne, nouveau])).rows;
  const l = (await db.query("select teaching_space_id, state from study.lessons where id = $1", [copie.seance])).rows[0];
  assert.equal(l.teaching_space_id, nouveau);
  assert.equal(l.state, "brouillon", "la copie naît en brouillon");
  assert.equal(copie.devoirs_ignores >= 0, true);
  // La copie, elle, est modifiable : elle vit dans un cours actif.
  const maj = await lirePour(db, ACTEURS.profMartin, "update study.lessons set title = 'Reprise' where id = $1 returning id", [copie.seance]);
  assert.equal(maj.length, 1);
});
