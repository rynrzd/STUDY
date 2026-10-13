// =============================================================================
// 0077 — Contrôle avant ouverture (ONB-05) et fiche classe (CL-03).
// =============================================================================

import { test } from "node:test";
import assert from "node:assert/strict";
import { ACTEURS, OBJETS, baseDeTest, doitEchouer } from "./harness.mjs";

const controle = async (db, acteur) => (await db.query("select study.etab_controle_ouverture($1) as r", [acteur])).rows[0].r;
const fiche = async (db, acteur, classe) => (await db.query("select study.etab_fiche_classe($1, $2) as r", [acteur, classe])).rows[0].r;

test("CTL-01 — le contrôle avant ouverture compte ce qui reste à régler, et se met à jour", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());
  const avant = await controle(db, ACTEURS.adminA);
  for (const cle of ["eleves_sans_classe", "professeurs_sans_cours", "cours_sans_professeur", "classes_sans_pp", "groupes_vides", "matieres_non_enseignees"]) {
    assert.equal(typeof avant[cle].n, "number", cle);
    assert.ok(Array.isArray(avant[cle].exemples), cle);
    assert.ok(avant[cle].exemples.length <= 5, "quelques exemples, pas toute la liste");
  }
  assert.ok(avant.classes_sans_pp.exemples.some((x) => x.id === OBJETS.classeA1));
  assert.ok(avant.professeurs_sans_cours.exemples.some((x) => x.id === ACTEURS.profAutre), "un professeur sans cours est signalé");

  await db.query("select study.etab_designer_professeur_principal($1, $2, $3)", [ACTEURS.adminA, OBJETS.classeA1, ACTEURS.profMartin]);
  const apres = await controle(db, ACTEURS.adminA);
  assert.equal(apres.classes_sans_pp.n, avant.classes_sans_pp.n - 1);

  // Un élève qui quitte sa classe apparaît « sans classe ».
  await db.query("update study.class_enrollments set ends_on = current_date - 1 where profile_id = $1", [ACTEURS.eleveA1Lina]);
  const depart = await controle(db, ACTEURS.adminA);
  assert.equal(depart.eleves_sans_classe.n, avant.eleves_sans_classe.n + 1);
});

test("CTL-02 — la fiche classe : élèves, professeur principal, cours, groupes de ses élèves", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());
  await db.query("select study.etab_designer_professeur_principal($1, $2, $3)", [ACTEURS.adminA, OBJETS.classeA1, ACTEURS.profMartin]);
  const f = await fiche(db, ACTEURS.adminA, OBJETS.classeA1);
  assert.equal(f.classe.id, OBJETS.classeA1);
  assert.equal(f.professeur_principal.id, ACTEURS.profMartin);
  const effectif = (await db.query("select count(*)::int n from study.class_enrollments where class_id = $1 and ends_on is null", [OBJETS.classeA1])).rows[0].n;
  assert.equal(f.eleves.length, effectif, "les élèves présents, comptés en base");
  assert.ok(f.eleves.some((e) => e.id === ACTEURS.eleveA1Rayan));
  assert.ok(f.cours.some((c) => c.espace === OBJETS.espaceMathsA1 && /\S/.test(c.professeurs ?? "")));
  const spe = f.groupes.find((g) => g.id === OBJETS.groupeSpecialite);
  assert.ok(spe, "la spécialité de Rayan est listée");
  assert.equal(spe.eleves_de_la_classe, 1, "seuls les élèves de cette classe sont comptés");
});

test("CTL-03 — réservé à l'administration de l'établissement", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());
  assert.match((await doitEchouer(() => fiche(db, ACTEURS.adminB, OBJETS.classeA1))).message, /hors de l etablissement/);
  assert.match((await doitEchouer(() => controle(db, ACTEURS.profMartin))).message, /non habilite/);
  for (const f of ["study.etab_controle_ouverture(uuid)", "study.etab_fiche_classe(uuid, uuid)"]) {
    for (const r of ["anon", "authenticated"]) {
      assert.equal((await db.query("select has_function_privilege($1, $2, 'execute') as ok", [r, f])).rows[0].ok, false, `${r} ${f}`);
    }
  }
});
