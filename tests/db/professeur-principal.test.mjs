// =============================================================================
// 0075 — Professeur principal désigné par l'administration ; consultation, en
// lecture seule, d'une année archivée (cahier des charges ch. 18, YR-04, YR-09).
// =============================================================================

import { test } from "node:test";
import assert from "node:assert/strict";
import { ACTEURS, OBJETS, baseDeTest, doitEchouer, lirePourAdmin } from "./harness.mjs";

const designer = (db, acteur, classe, prof) =>
  db.query("select study.etab_designer_professeur_principal($1, $2, $3) as r", [acteur, classe, prof]).then((x) => x.rows[0].r);

test("PP-01 — désigner, remplacer, retirer le professeur principal ; chaque geste est journalisé", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());

  assert.equal(await designer(db, ACTEURS.adminA, OBJETS.classeA1, ACTEURS.profMartin), "designe");
  assert.equal(await designer(db, ACTEURS.adminA, OBJETS.classeA1, ACTEURS.profMartin), "inchange", "rejouer ne change rien");
  const liste = (await db.query("select * from study.etab_professeurs_principaux($1)", [ACTEURS.adminA])).rows;
  assert.deepEqual(liste.map((l) => [l.classe, l.profil]), [[OBJETS.classeA1, ACTEURS.profMartin]]);

  // La désignation ouvre les droits déjà prévus en 0045.
  await db.exec("set role authenticated;");
  await db.query("select set_config('study.user_id', $1, false)", [ACTEURS.profMartin]);
  const pp = (await db.query("select study.est_professeur_principal($1) as v", [OBJETS.classeA1])).rows[0].v;
  await db.exec("reset role; select set_config('study.user_id', '', false);");
  assert.equal(pp, true);

  assert.equal(await designer(db, ACTEURS.adminA, OBJETS.classeA1, ACTEURS.profAutre), "designe");
  assert.equal(await designer(db, ACTEURS.adminA, OBJETS.classeA1, null), "retire");
  assert.equal((await db.query("select professeur_principal from study.classes where id = $1", [OBJETS.classeA1])).rows[0].professeur_principal, null);

  const journal = (await db.query("select action from study.audit_events where object_id = $1 and action like 'professeur_principal%' order by id", [OBJETS.classeA1])).rows.map((r) => r.action);
  assert.equal(journal.length, 3);
  assert.equal(journal.filter((a) => a === "professeur_principal_retire").length, 1);
});

test("PP-02 — seul un professeur actif de l'établissement ; jamais depuis un autre lycée", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());
  assert.match((await doitEchouer(() => designer(db, ACTEURS.adminA, OBJETS.classeA1, ACTEURS.eleveA1Rayan))).message, /non enseignant/);
  assert.match((await doitEchouer(() => designer(db, ACTEURS.adminB, OBJETS.classeA1, ACTEURS.profMartin))).message, /hors de l etablissement/);
  assert.match((await doitEchouer(() => designer(db, ACTEURS.profMartin, OBJETS.classeA1, ACTEURS.profMartin))).message, /non habilite/);
  for (const f of ["study.etab_designer_professeur_principal(uuid, uuid, uuid)", "study.etab_professeurs_principaux(uuid)", "study.etab_annee_archivee(uuid, uuid)"]) {
    for (const r of ["anon", "authenticated"]) {
      assert.equal((await db.query("select has_function_privilege($1, $2, 'execute') as ok", [r, f])).rows[0].ok, false, `${r} : ${f}`);
    }
  }
});

test("ARC-01 — une année archivée se consulte en lecture seule, sans nom d'élève", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());
  await designer(db, ACTEURS.adminA, OBJETS.classeA1, ACTEURS.profMartin);
  const ancienne = (await db.query("select academic_year_id from study.classes where id = $1", [OBJETS.classeA1])).rows[0].academic_year_id;

  // Encore courante : refusée, ce n'est pas un relevé d'archive.
  assert.match((await doitEchouer(() => db.query("select study.etab_annee_archivee($1, $2)", [ACTEURS.adminA, ancienne]))).message, /non archivee/);

  const [{ annee_preparer: nouvelle }] = await lirePourAdmin(db, ACTEURS.adminA, "select study.annee_preparer('2027-2028', current_date - 1, current_date + 300)");
  const [{ annee_creer_classe: c1 }] = await lirePourAdmin(db, ACTEURS.adminA, "select study.annee_creer_classe($1, 'Première 1')", [nouvelle]);
  await lirePourAdmin(db, ACTEURS.adminA, "select study.annee_preinscrire_classe($1, $2)", [OBJETS.classeA1, c1]);
  await lirePourAdmin(db, ACTEURS.adminA, "select study.annee_basculer($1, true)", [nouvelle]);

  const r = (await db.query("select study.etab_annee_archivee($1, $2) as r", [ACTEURS.adminA, ancienne])).rows[0].r;
  assert.ok(r.annee.archivee_le, "étiquette « Année archivée » possible");
  const a1 = r.classes.find((c) => c.id === OBJETS.classeA1);
  assert.ok(a1.effectif >= 2, "les élèves de l'an dernier restent comptés");
  assert.match(a1.professeur_principal, /\S/);
  assert.ok(r.groupes.length >= 1);
  assert.ok(r.cours.some((c) => c.genre === "classe" && /\S/.test(c.professeurs ?? "")), "les cours gardent leurs professeurs");
  const texte = JSON.stringify(r);
  const eleves = (await db.query("select first_name, last_name from study.profiles where id = any($1)", [[ACTEURS.eleveA1Rayan, ACTEURS.eleveA1Lina]])).rows;
  for (const e of eleves) assert.ok(!texte.includes(e.last_name), "aucun nom d'élève dans le relevé");

  assert.match((await doitEchouer(() => db.query("select study.etab_annee_archivee($1, $2)", [ACTEURS.adminB, ancienne]))).message, /hors de l etablissement|non habilite/);
  // La classe archivée ne reçoit plus de professeur principal.
  assert.match((await doitEchouer(() => designer(db, ACTEURS.adminA, OBJETS.classeA1, ACTEURS.profAutre))).message, /archivee/);
});
