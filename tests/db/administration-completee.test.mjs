// =============================================================================
// 0082 — Administration complétée : coordinateur de groupe (GR-12), export des
// groupes (GR-15), effectif à une date (CL-09), préinscription individuelle
// (EL-08), reconduction des cours (PROF-18, YR-08), comparaison des années
// (YR-11), journal des exports et activité inhabituelle (SEC-19, SEC-20),
// limites (SEC-15), double bascule refusée (YR-10).
// =============================================================================

import { test } from "node:test";
import assert from "node:assert/strict";
import { ACTEURS, OBJETS, baseDeTest, doitEchouer, lirePourAdmin } from "./harness.mjs";

const q = async (db, sql, params = []) => (await db.query(sql, params)).rows;

async function anneePreparee(db) {
  const [{ annee_preparer: annee }] = await lirePourAdmin(db, ACTEURS.adminA, "select study.annee_preparer('2027-2028', current_date + 200, current_date + 500)");
  const [{ annee_creer_classe: c1 }] = await lirePourAdmin(db, ACTEURS.adminA, "select study.annee_creer_classe($1, 'Première 1')", [annee]);
  const [{ annee_creer_classe: c2 }] = await lirePourAdmin(db, ACTEURS.adminA, "select study.annee_creer_classe($1, 'Seconde 1 bis')", [annee]);
  await lirePourAdmin(db, ACTEURS.adminA, "select study.annee_preinscrire_classe($1, $2)", [OBJETS.classeA1, c1]);
  return { annee, c1, c2 };
}

test("ADM-01 — coordinateur de groupe, sans droit d'administration ; export des groupes", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());
  assert.equal((await q(db, "select study.etab_designer_coordinateur($1, $2, $3) as r", [ACTEURS.adminA, OBJETS.groupeSpecialite, ACTEURS.profMartin]))[0].r, "designe");
  assert.equal((await q(db, "select * from study.etab_coordinateur($1, $2)", [ACTEURS.adminA, OBJETS.groupeSpecialite]))[0].profil, ACTEURS.profMartin);
  assert.equal((await q(db, "select count(*)::int n from study.etab_contexte($1)", [ACTEURS.profMartin]))[0].n, 0, "aucun droit d'administration gagné");
  await doitEchouer(() => q(db, "select study.etab_designer_coordinateur($1, $2, $3)", [ACTEURS.adminA, OBJETS.groupeSpecialite, ACTEURS.eleveA1Rayan]));

  const exp = await q(db, "select * from study.etab_export_groupes($1)", [ACTEURS.adminA]);
  assert.ok(exp.some((l) => l.identifiant && l.groupe));
  assert.equal((await q(db, "select * from study.etab_export_groupes($1)", [ACTEURS.adminB])).some((l) => exp.some((e) => e.identifiant === l.identifiant)), false);
});

test("ADM-02 — effectif d'une classe à une date", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());
  const aujourdhui = (await q(db, "select study.etab_effectif_classe($1, $2, current_date) as n", [ACTEURS.adminA, OBJETS.classeA1]))[0].n;
  await db.query("update study.class_enrollments set ends_on = current_date - 1 where profile_id = $1", [ACTEURS.eleveA1Lina]);
  assert.equal((await q(db, "select study.etab_effectif_classe($1, $2, current_date) as n", [ACTEURS.adminA, OBJETS.classeA1]))[0].n, aujourdhui - 1);
  assert.equal((await q(db, "select study.etab_effectif_classe($1, $2, current_date - 2) as n", [ACTEURS.adminA, OBJETS.classeA1]))[0].n, aujourdhui, "l'effectif d'avant-hier compte encore Lina");
  await doitEchouer(() => q(db, "select study.etab_effectif_classe($1, $2, current_date)", [ACTEURS.adminB, OBJETS.classeA1]));
});

test("ADM-03 — redoublement : un élève préinscrit ailleurs que sa classe", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());
  const { c1, c2 } = await anneePreparee(db);
  assert.equal((await q(db, "select study.etab_preinscrire_eleve($1, $2, $3) as r", [ACTEURS.adminA, ACTEURS.eleveA1Rayan, c2]))[0].r, "modifie");
  const ou = await q(db, "select class_id from study.class_enrollments where profile_id = $1 and class_id = any($2)", [ACTEURS.eleveA1Rayan, [c1, c2]]);
  assert.deepEqual(ou.map((x) => x.class_id), [c2], "une seule préinscription, la bonne");
  await doitEchouer(() => q(db, "select study.etab_preinscrire_eleve($1, $2, $3)", [ACTEURS.adminA, ACTEURS.eleveA1Rayan, OBJETS.classeA2]), "pas une classe de l'année en cours");
});

test("ADM-04 — reconduire les cours de classe et leurs professeurs, en écartant celui qui part", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());
  const { annee, c1 } = await anneePreparee(db);
  const lignes = await q(db, "select * from study.etab_cours_a_reconduire($1, $2)", [ACTEURS.adminA, annee]);
  const maths = lignes.find((l) => l.espace === OBJETS.espaceMathsA1);
  assert.equal(maths.suggestion, c1, "la classe qui reçoit ses élèves est proposée");
  assert.ok(maths.professeurs.some((p) => p.id === ACTEURS.profMartin));

  const r = (await q(db, "select study.etab_reconduire_cours($1, $2, $3::jsonb) as r", [ACTEURS.adminA, annee, JSON.stringify([{ espace: OBJETS.espaceMathsA1, classe: c1, exclus: [] }])]))[0].r;
  assert.equal(r.cours, 1);
  const nouvel = (await q(db, "select id from study.teaching_spaces where class_id = $1", [c1]))[0].id;
  const profs = await q(db, "select profile_id, starts_on = (select starts_on from study.academic_years where id = $2) as rentree from study.teacher_assignments where teaching_space_id = $1", [nouvel, annee]);
  assert.deepEqual(profs.map((p) => [p.profile_id, p.rentree]), [[ACTEURS.profMartin, true]]);
  assert.equal((await q(db, "select count(*)::int n from study.class_enrollments where class_id = $1 and is_principal", [c1]))[0].n, 0, "aucun élève inscrit d'office");

  // Rejouer ne duplique rien ; un professeur écarté n'est pas reconduit.
  const rejeu = (await q(db, "select study.etab_reconduire_cours($1, $2, $3::jsonb) as r", [ACTEURS.adminA, annee, JSON.stringify([{ espace: OBJETS.espaceMathsA1, classe: c1, exclus: [ACTEURS.profMartin] }])]))[0].r;
  assert.equal(rejeu.cours, 0);
  assert.equal((await q(db, "select count(*)::int n from study.teacher_assignments where teaching_space_id = $1", [nouvel]))[0].n, 1);
});

test("ADM-05 — comparaison des années, sans donnée individuelle", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());
  await anneePreparee(db);
  const r = await q(db, "select * from study.etab_comparaison_annees($1)", [ACTEURS.adminA]);
  assert.ok(r.length >= 2);
  const courante = r.find((x) => x.courante);
  assert.ok(courante.classes >= 2 && courante.eleves >= 3 && courante.cours >= 1);
  assert.deepEqual(Object.keys(r[0]).sort(), ["annee", "archivee", "classes", "courante", "cours", "cours_sans_professeur", "eleves", "groupes", "label"]);
});

test("ADM-06 — exports journalisés ; activité inhabituelle au-delà d'un seuil", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());
  assert.equal((await q(db, "select * from study.etab_activite_inhabituelle($1)", [ACTEURS.adminA])).length, 0);
  for (let i = 0; i < 10; i++) await q(db, "select study.etab_journaliser_export($1, 'acces', 30)", [ACTEURS.adminA]);
  const alertes = await q(db, "select * from study.etab_activite_inhabituelle($1)", [ACTEURS.adminA]);
  assert.deepEqual(alertes.map((a) => [a.alerte, a.nombre]), [["exports", 10]]);
  assert.equal((await q(db, "select * from study.etab_activite_inhabituelle($1)", [ACTEURS.adminB])).length, 0, "chaque lycée ne voit que le sien");
  await doitEchouer(() => q(db, "select study.etab_journaliser_export($1, 'acces; drop', 1)", [ACTEURS.adminA]));
});

test("ADM-07 — limites par établissement, réglables par l'exploitation", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());
  const [d] = await q(db, "select * from study.etab_limites($1)", [ACTEURS.adminA]);
  assert.equal(d.groupes_max, 400);
  await db.query("insert into study.limites_etablissement (organization_id, groupes_max) values ($1, 3)", [ACTEURS.lyceeA]);
  const [l] = await q(db, "select * from study.etab_limites($1)", [ACTEURS.adminA]);
  assert.equal(l.groupes_max, 3);
  assert.ok(l.groupes >= 1);
  assert.equal((await db.query("select has_table_privilege('authenticated', 'study.limites_etablissement', 'select') as ok")).rows[0].ok, false);
});

test("ADM-08 — une seconde bascule vers la même année est refusée", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());
  const [{ annee_preparer: annee }] = await lirePourAdmin(db, ACTEURS.adminA, "select study.annee_preparer('2027-2028', current_date - 1, current_date + 300)");
  const [{ annee_creer_classe: c1 }] = await lirePourAdmin(db, ACTEURS.adminA, "select study.annee_creer_classe($1, 'Première 1')", [annee]);
  await lirePourAdmin(db, ACTEURS.adminA, "select study.annee_preinscrire_classe($1, $2)", [OBJETS.classeA1, c1]);
  const [premier] = await lirePourAdmin(db, ACTEURS.adminA, "select study.annee_basculer($1, true) as r", [annee]);
  assert.equal(premier.r, true);
  const archivees = (await q(db, "select count(*)::int n from study.academic_years where archived_at is not null"))[0].n;
  // La seconde bascule attend le verrou de l'année (for update), puis ne fait rien.
  const [second] = await lirePourAdmin(db, ACTEURS.adminA, "select study.annee_basculer($1, true) as r", [annee]);
  assert.equal(second.r, false, "refusée : l'année est déjà la courante");
  assert.equal((await q(db, "select count(*)::int n from study.academic_years where archived_at is not null"))[0].n, archivees, "aucun effet de plus");
});

test("ADM-09 — rien de tout cela sans compte", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());
  for (const f of [
    "study.etab_designer_coordinateur(uuid, uuid, uuid)", "study.etab_coordinateur(uuid, uuid)", "study.etab_export_groupes(uuid)",
    "study.etab_effectif_classe(uuid, uuid, date)", "study.etab_preinscrire_eleve(uuid, uuid, uuid)", "study.etab_cours_a_reconduire(uuid, uuid)",
    "study.etab_reconduire_cours(uuid, uuid, jsonb)", "study.etab_comparaison_annees(uuid)", "study.etab_journaliser_export(uuid, text, integer)",
    "study.etab_activite_inhabituelle(uuid)", "study.etab_limites(uuid)",
  ]) {
    for (const role of ["anon", "authenticated"]) {
      assert.equal((await db.query("select has_function_privilege($1, $2, 'execute') as ok", [role, f])).rows[0].ok, false, `${role} ${f}`);
    }
  }
});
