// =============================================================================
// 0069 — Rôle et dates des affectations, fin d'une affectation (cahier des
// charges ch. 08). Un remplaçant n'a accès que pendant sa période ; un
// remplacement sans fin est refusé ; terminer une affectation ne touche
// qu'elle.
// =============================================================================

import { test } from "node:test";
import assert from "node:assert/strict";
import { ACTEURS, OBJETS, baseDeTest, doitEchouer } from "./harness.mjs";

const MATHS_A = "aaaaaaaa-3334-4000-8000-000000000001";
const jour = async (db, decalage) => (await db.query("select (current_date + $1::int)::text d", [decalage])).rows[0].d;
const affecter = async (db, professeur, lignes) =>
  (await db.query("select * from study.etab_affecter_professeur_plusieurs($1, $2, $3::jsonb) order by rang", [ACTEURS.adminA, professeur, JSON.stringify(lignes)])).rows;
async function enseigne(db, prof, espace) {
  await db.exec("set role authenticated;");
  await db.query("select set_config('study.user_id', $1, false)", [prof]);
  try {
    return (await db.query("select study.teaches_space($1) as v", [espace])).rows[0].v;
  } finally {
    await db.exec("reset role; select set_config('study.user_id', '', false);");
  }
}

test("ROLE-01 — un remplaçant n'enseigne que pendant sa période", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());
  const physique = (await db.query("select study.etab_creer_matiere($1, 'Physique') as id", [ACTEURS.adminA])).rows[0].id;

  const [enCours, expire] = await affecter(db, ACTEURS.profAutre, [
    { genre: "classe", cible: OBJETS.classeA2, matiere: MATHS_A, role: "remplacant", debut: await jour(db, -3), fin: await jour(db, 14) },
    { genre: "classe", cible: OBJETS.classeA1, matiere: physique, role: "remplacant", debut: await jour(db, -10), fin: await jour(db, -1) },
  ]);
  assert.equal(enCours.resultat, "creee");
  assert.equal(expire.resultat, "creee");
  assert.equal(await enseigne(db, ACTEURS.profAutre, enCours.espace), true, "pendant la période : accès");
  assert.equal(await enseigne(db, ACTEURS.profAutre, expire.espace), false, "période terminée : plus d'accès, sans geste manuel");

  const role = (await db.query("select role_in_space from study.teacher_assignments where teaching_space_id = $1 and profile_id = $2", [enCours.espace, ACTEURS.profAutre])).rows[0].role_in_space;
  assert.equal(role, "remplacant");
});

test("ROLE-02 — un remplacement sans fin, ou des dates à l'envers, sont refusés", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());
  const r = await affecter(db, ACTEURS.profAutre, [
    { genre: "classe", cible: OBJETS.classeA1, matiere: MATHS_A, role: "remplacant" },
    { genre: "classe", cible: OBJETS.classeA2, matiere: MATHS_A, debut: await jour(db, 5), fin: await jour(db, 2) },
    { genre: "classe", cible: OBJETS.classeA2, matiere: MATHS_A, role: "directeur" },
  ]);
  assert.deepEqual(r.map((x) => x.raison), ["fin_requise", "dates_invalides", "ligne_invalide"]);
});

test("ROLE-03 — un co-intervenant enseigne avec le titulaire ; la lecture montre les deux, classes et groupes", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());
  const [r] = await affecter(db, ACTEURS.profAutre, [{ genre: "classe", cible: OBJETS.classeA1, matiere: MATHS_A, role: "co_intervenant" }]);
  assert.equal(r.resultat, "creee");
  assert.equal(r.espace, OBJETS.espaceMathsA1, "même cours, pas un second espace");
  assert.equal(await enseigne(db, ACTEURS.profMartin, OBJETS.espaceMathsA1), true);
  assert.equal(await enseigne(db, ACTEURS.profAutre, OBJETS.espaceMathsA1), true);

  const lignes = (await db.query("select * from study.etab_affectations_professeurs($1)", [ACTEURS.adminA])).rows;
  const surA1 = lignes.filter((l) => l.teaching_space_id === OBJETS.espaceMathsA1).map((l) => l.role).sort();
  assert.deepEqual(surA1, ["co_intervenant", "titulaire"]);
  assert.ok(lignes.some((l) => l.genre === "groupe" && l.profile_id === ACTEURS.profMartin), "les cours de groupe apparaissent aussi");
  assert.equal((await db.query("select count(*)::int n from study.etab_affectations_professeurs($1)", [ACTEURS.adminB])).rows[0].n > 0, true);
  assert.ok((await db.query("select * from study.etab_affectations_professeurs($1)", [ACTEURS.adminB])).rows.every((l) => l.profile_id !== ACTEURS.profMartin), "rien du lycée A chez le lycée B");
});

test("ROLE-04 — terminer une affectation ne touche qu'elle", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());
  const ids = async () => (await db.query("select id, teaching_space_id, ends_on from study.teacher_assignments where profile_id = $1 order by teaching_space_id", [ACTEURS.profMartin])).rows;
  const avant = await ids();
  const cible = avant.find((a) => a.teaching_space_id === OBJETS.espaceMathsA2);

  const issue = (await db.query("select study.etab_terminer_affectation($1, $2, (current_date - 1)) as r", [ACTEURS.adminA, cible.id])).rows[0].r;
  assert.equal(issue, "terminee");
  assert.equal(await enseigne(db, ACTEURS.profMartin, OBJETS.espaceMathsA2), false);
  assert.equal(await enseigne(db, ACTEURS.profMartin, OBJETS.espaceMathsA1), true, "les autres affectations restent");
  assert.equal(await enseigne(db, ACTEURS.profMartin, OBJETS.espaceSpecialite), true);
  assert.equal((await ids()).length, avant.length, "rien de supprimé");

  // Une affectation à venir, jamais commencée : retirée.
  const [future] = await affecter(db, ACTEURS.profAutre, [{ genre: "classe", cible: OBJETS.classeA2, matiere: MATHS_A, debut: await jour(db, 10) }]);
  const idFuture = (await db.query("select id from study.teacher_assignments where teaching_space_id = $1 and profile_id = $2", [future.espace, ACTEURS.profAutre])).rows[0].id;
  assert.equal((await db.query("select study.etab_terminer_affectation($1, $2) as r", [ACTEURS.adminA, idFuture])).rows[0].r, "retiree");

  assert.match((await doitEchouer(() => db.query("select study.etab_terminer_affectation($1, $2)", [ACTEURS.adminB, avant[0].id]))).message, /hors de l etablissement/);
});

test("ROLE-05 — les nouvelles fonctions ne sont pas exécutables sans compte", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());
  for (const f of ["study.etab_terminer_affectation(uuid, uuid, date)", "study.etab_affectations_professeurs(uuid)"]) {
    for (const role of ["anon", "authenticated"]) {
      assert.equal((await db.query("select has_function_privilege($1, $2, 'execute') as ok", [role, f])).rows[0].ok, false);
    }
  }
});
