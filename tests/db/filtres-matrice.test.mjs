// =============================================================================
// 0078 — Filtres des groupes (GR-01) et vue d'ensemble des enseignements
// (ENS-02).
// =============================================================================

import { test } from "node:test";
import assert from "node:assert/strict";
import { ACTEURS, OBJETS, baseDeTest } from "./harness.mjs";

test("FIL-01 — chaque groupe dit ses matières, ses professeurs et les classes de ses élèves", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());
  const lignes = (await db.query("select * from study.etab_groupes_details($1)", [ACTEURS.adminA])).rows;
  const spe = lignes.find((l) => l.groupe === OBJETS.groupeSpecialite);
  assert.ok(spe.matieres.length >= 1);
  assert.ok(spe.professeurs.length >= 1);
  assert.ok(spe.classes_sources.length >= 1, "les classes d'origine de ses élèves");
  assert.equal((await db.query("select * from study.etab_groupes_details($1)", [ACTEURS.adminB])).rows.some((l) => l.groupe === OBJETS.groupeSpecialite), false, "rien d'un autre lycée");
});

test("FIL-02 — la vue d'ensemble liste chaque enseignement en cours, avec ou sans professeur", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());
  const avant = (await db.query("select * from study.etab_matrice_enseignements($1)", [ACTEURS.adminA])).rows;
  const a1 = avant.find((l) => l.espace === OBJETS.espaceMathsA1);
  assert.equal(a1.genre, "classe");
  assert.equal(a1.cible, OBJETS.classeA1);
  assert.ok(a1.intervenants.length >= 1 && a1.intervenants[0].role);
  assert.ok(avant.some((l) => l.genre === "groupe"), "les groupes aussi");

  await db.query("update study.teacher_assignments set ends_on = current_date - 1 where teaching_space_id = $1", [OBJETS.espaceMathsA1]);
  const apres = (await db.query("select * from study.etab_matrice_enseignements($1)", [ACTEURS.adminA])).rows;
  assert.deepEqual(apres.find((l) => l.espace === OBJETS.espaceMathsA1).intervenants, [], "un cours sans professeur reste visible");

  assert.equal((await db.query("select * from study.etab_matrice_enseignements($1)", [ACTEURS.profMartin])).rows.length, 0, "un non-administrateur ne reçoit rien");
  assert.equal((await db.query("select * from study.etab_groupes_details($1)", [ACTEURS.profMartin])).rows.length, 0);
  for (const f of ["study.etab_groupes_details(uuid)", "study.etab_matrice_enseignements(uuid)"]) {
    for (const r of ["anon", "authenticated"]) {
      assert.equal((await db.query("select has_function_privilege($1, $2, 'execute') as ok", [r, f])).rows[0].ok, false, `${r} ${f}`);
    }
  }
});
