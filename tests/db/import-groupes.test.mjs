// =============================================================================
// 0079 — Import de groupes par fichier (IMP-01, IMP-02, IMP-05, IMP-07,
// IMP-08, IMP-09).
// =============================================================================

import { test } from "node:test";
import assert from "node:assert/strict";
import { ACTEURS, baseDeTest, doitEchouer } from "./harness.mjs";

const importer = async (db, lignes, options = {}) =>
  (
    await db.query("select study.etab_import_groupes($1, $2::jsonb, $3, $4, $5) as r", [
      options.acteur ?? ACTEURS.adminA,
      JSON.stringify(lignes),
      options.appliquer ?? false,
      options.appartenances ?? true,
      options.enseignements ?? true,
    ])
  ).rows[0].r;

async function identifiants(db) {
  const r = await db.query(
    "select profile_id, local_login from study.organization_memberships where organization_id = $1 and profile_id = any($2)",
    [ACTEURS.lyceeA, [ACTEURS.eleveA1Lina, ACTEURS.eleveA2Samir, ACTEURS.profAutre]],
  );
  return Object.fromEntries(r.rows.map((x) => [x.profile_id, x.local_login]));
}

test("IMPG-01 — l'aperçu ne crée rien et dit le sort de chaque ligne", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());
  const ids = await identifiants(db);
  const avant = (await db.query("select count(*)::int n from study.teaching_groups")).rows[0].n;
  const r = await importer(db, [
    { groupe: "Anglais B", eleve: ids[ACTEURS.eleveA1Lina] },
    { groupe: "Anglais B", eleve: ids[ACTEURS.eleveA2Samir] },
    { groupe: "Anglais B", eleve: "inconnu.du.lycee" },
    { groupe: "", eleve: ids[ACTEURS.eleveA1Lina] },
  ]);
  assert.equal(r.applique, false);
  assert.equal(r.resume.groupes_nouveaux, 1);
  assert.equal(r.resume.appartenances_nouvelles, 2);
  assert.equal(r.resume.eleves_inconnus, 1);
  assert.deepEqual(r.lignes.map((l) => l.eleve), ["nouveau", "nouveau", "inconnu", "rejete"]);
  assert.equal((await db.query("select count(*)::int n from study.teaching_groups")).rows[0].n, avant, "IMP-01 : rien d'écrit");
});

test("IMPG-02 — appliquer crée groupe, membres et enseignement ; rejouer ne duplique rien", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());
  const ids = await identifiants(db);
  const matiere = (await db.query("select study.etab_creer_matiere($1, 'Anglais') as id", [ACTEURS.adminA])).rows[0].id;
  assert.ok(matiere);
  const lignes = [
    { groupe: "Anglais B", eleve: ids[ACTEURS.eleveA1Lina], matiere: "Anglais", professeur: ids[ACTEURS.profAutre] },
    { groupe: "Anglais B", eleve: ids[ACTEURS.eleveA2Samir], matiere: "Anglais", professeur: ids[ACTEURS.profAutre] },
  ];
  const r = await importer(db, lignes, { appliquer: true });
  assert.equal(r.resume.groupes_nouveaux, 1);
  assert.equal(r.resume.appartenances_nouvelles, 2);
  assert.equal(r.resume.enseignements_nouveaux, 1, "un enseignement, pas un par ligne");
  const g = (await db.query("select id from study.teaching_groups where label = 'Anglais B'")).rows;
  assert.equal(g.length, 1);
  assert.equal((await db.query("select count(*)::int n from study.group_memberships where group_id = $1", [g[0].id])).rows[0].n, 2);
  assert.equal((await db.query("select count(*)::int n from study.teaching_spaces ts join study.teacher_assignments a on a.teaching_space_id = ts.id where ts.group_id = $1 and a.profile_id = $2", [g[0].id, ACTEURS.profAutre])).rows[0].n, 1);

  const rejeu = await importer(db, lignes, { appliquer: true });
  assert.equal(rejeu.resume.groupes_nouveaux, 0);
  assert.equal(rejeu.resume.deja_membres, 2);
  assert.equal(rejeu.resume.enseignements_existants, 1);
  assert.equal((await db.query("select count(*)::int n from study.teaching_groups where label = 'Anglais B'")).rows[0].n, 1, "IMP-07 : aucun doublon");
  assert.equal((await db.query("select count(*)::int n from study.group_memberships where group_id = $1", [g[0].id])).rows[0].n, 2);
});

test("IMPG-03 — validation séparée : appartenances sans enseignements", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());
  const ids = await identifiants(db);
  await db.query("select study.etab_creer_matiere($1, 'Anglais')", [ACTEURS.adminA]);
  await importer(db, [{ groupe: "Anglais C", eleve: ids[ACTEURS.eleveA1Lina], matiere: "Anglais", professeur: ids[ACTEURS.profAutre] }], { appliquer: true, enseignements: false });
  const g = (await db.query("select id from study.teaching_groups where label = 'Anglais C'")).rows[0].id;
  assert.equal((await db.query("select count(*)::int n from study.group_memberships where group_id = $1", [g])).rows[0].n, 1);
  assert.equal((await db.query("select count(*)::int n from study.teaching_spaces where group_id = $1", [g])).rows[0].n, 0, "aucun enseignement créé sans accord");
});

test("IMPG-04 — un identifiant ambigu n'est jamais fusionné ; un autre lycée n'est pas atteint", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());
  const ids = await identifiants(db);
  // Le même identifiant externe pour deux élèves différents : ambigu.
  await db.query("insert into study.external_identities (organization_id, profile_id, source, external_id) values ($1, $2, 'import_eleves', $3)", [ACTEURS.lyceeA, ACTEURS.eleveA2Samir, ids[ACTEURS.eleveA1Lina]]);
  const r = await importer(db, [{ groupe: "Latin", eleve: ids[ACTEURS.eleveA1Lina] }], { appliquer: true });
  assert.equal(r.lignes[0].eleve, "ambigu");
  const g = (await db.query("select id from study.teaching_groups where label = 'Latin'")).rows[0].id;
  assert.equal((await db.query("select count(*)::int n from study.group_memberships where group_id = $1", [g])).rows[0].n, 0, "personne n'est ajouté à tort");

  // L'admin du lycée B ne trouve pas les élèves du lycée A.
  const b = await importer(db, [{ groupe: "Latin", eleve: ids[ACTEURS.eleveA2Samir] }], { acteur: ACTEURS.adminB });
  assert.equal(b.lignes[0].eleve, "inconnu");
  await doitEchouer(() => importer(db, [], { acteur: ACTEURS.profMartin }));
  for (const r2 of ["anon", "authenticated"]) {
    assert.equal((await db.query("select has_function_privilege($1, 'study.etab_import_groupes(uuid, jsonb, boolean, boolean, boolean)', 'execute') as ok", [r2])).rows[0].ok, false);
  }
});
