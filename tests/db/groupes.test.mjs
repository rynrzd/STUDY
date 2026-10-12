// =============================================================================
// 0065 — Groupes pédagogiques (cahier des charges, ch. 07). Un groupe
// interclasses réunit des élèves de plusieurs classes ; seuls ses membres
// explicites voient son cours ; l'historique d'appartenance est conservé ;
// rien ne traverse la frontière d'un établissement.
// =============================================================================

import { test } from "node:test";
import assert from "node:assert/strict";
import { ACTEURS, baseDeTest, doitEchouer } from "./harness.mjs";

const ORG = ACTEURS.lyceeA;

async function annee(db, acteur) {
  return (await db.query("select academic_year_id a from study.etab_contexte($1)", [acteur])).rows[0].a;
}
async function matiere(db, acteur, label) {
  return (await db.query("select study.etab_creer_matiere($1, $2) as id", [acteur, label])).rows[0].id;
}
/** study.attends_space évalué sous l'identité d'un élève (RLS, SECURITY DEFINER). */
async function voit(db, eleve, espace) {
  await db.exec("set role authenticated;");
  await db.query("select set_config('study.user_id', $1, false)", [eleve]);
  try {
    return (await db.query("select study.attends_space($1) as v", [espace])).rows[0].v;
  } finally {
    await db.exec("reset role; select set_config('study.user_id', '', false);");
  }
}

test("GROUPE-01 — un groupe interclasses : membres de deux classes, seuls eux voient le cours", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());
  const an = await annee(db, ACTEURS.adminA);
  const maths = await matiere(db, ACTEURS.adminA, "Spécialité Maths");

  const groupe = (await db.query("select study.etab_creer_groupe($1, $2, 'Spé Maths A', 'interclasses') as id", [ACTEURS.adminA, an])).rows[0].id;

  // Rayan (classe A1) et Samir (classe A2), de deux classes administratives.
  const ajoutes = (await db.query("select study.etab_groupe_ajouter_eleves($1, $2, $3) as n", [ACTEURS.adminA, groupe, [ACTEURS.eleveA1Rayan, ACTEURS.eleveA2Samir]])).rows[0].n;
  assert.equal(ajoutes, 2);

  const espace = (await db.query("select study.etab_affecter_professeur_groupe($1, $2, $3, $4, $5) as id", [ACTEURS.adminA, ACTEURS.profMartin, groupe, maths, an])).rows[0].id;

  // L'espace cible bien un groupe, jamais une classe.
  const cible = (await db.query("select class_id, group_id from study.teaching_spaces where id = $1", [espace])).rows[0];
  assert.equal(cible.class_id, null);
  assert.equal(cible.group_id, groupe);

  // Les deux membres voient le cours ; Lina (classe A1, non membre) ne le voit pas.
  assert.equal(await voit(db, ACTEURS.eleveA1Rayan, espace), true, "Rayan est membre");
  assert.equal(await voit(db, ACTEURS.eleveA2Samir, espace), true, "Samir est membre");
  assert.equal(await voit(db, ACTEURS.eleveA1Lina, espace), false, "Lina est dans la classe source mais pas dans le groupe");

  // Le professeur affecté enseigne bien cet espace.
  await db.exec("set role authenticated;");
  await db.query("select set_config('study.user_id', $1, false)", [ACTEURS.profMartin]);
  assert.equal((await db.query("select study.teaches_space($1) as v", [espace])).rows[0].v, true);
  await db.exec("reset role; select set_config('study.user_id', '', false);");

  // Les lectures d'administration voient le groupe, ses deux membres et son cours.
  const liste = (await db.query("select * from study.etab_groupes($1) where id = $2", [ACTEURS.adminA, groupe])).rows[0];
  assert.equal(liste.effectif, 2);
  assert.equal(liste.cours, 1);
  const membres = (await db.query("select * from study.etab_groupe_membres($1, $2)", [ACTEURS.adminA, groupe])).rows;
  assert.deepEqual(membres.map((m) => m.profile_id).sort(), [ACTEURS.eleveA1Rayan, ACTEURS.eleveA2Samir].sort(), "deux membres, de deux classes");
  assert.ok(membres.every((m) => typeof m.classe === "string" && m.classe.length > 0), "chaque membre porte sa classe principale");

  const cours = (await db.query("select * from study.etab_groupe_cours($1, $2)", [ACTEURS.adminA, groupe])).rows;
  assert.equal(cours.length, 1);
  assert.equal(cours[0].professeur_id, ACTEURS.profMartin);
});

test("GROUPE-02 — idempotence et historique : rien n'est dupliqué, un retrait ne supprime pas la ligne", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());
  const an = await annee(db, ACTEURS.adminA);

  const g1 = (await db.query("select study.etab_creer_groupe($1, $2, 'Latin', 'interclasses') as id", [ACTEURS.adminA, an])).rows[0].id;
  const g2 = (await db.query("select study.etab_creer_groupe($1, $2, 'latin', 'interclasses') as id", [ACTEURS.adminA, an])).rows[0].id;
  assert.equal(g1, g2, "même code normalisé : le groupe existant est renvoyé, pas un doublon");

  const premier = (await db.query("select study.etab_groupe_ajouter_eleves($1, $2, $3) as n", [ACTEURS.adminA, g1, [ACTEURS.eleveA1Rayan]])).rows[0].n;
  const second = (await db.query("select study.etab_groupe_ajouter_eleves($1, $2, $3) as n", [ACTEURS.adminA, g1, [ACTEURS.eleveA1Rayan]])).rows[0].n;
  assert.equal(premier, 1);
  assert.equal(second, 0, "déjà membre : pas de seconde ligne");
  assert.equal((await db.query("select count(*)::int n from study.group_memberships where group_id = $1 and profile_id = $2", [g1, ACTEURS.eleveA1Rayan])).rows[0].n, 1);

  // Retrait : la ligne est clôturée, pas supprimée.
  await db.query("select study.etab_groupe_retirer_eleve($1, $2, $3)", [ACTEURS.adminA, g1, ACTEURS.eleveA1Rayan]);
  const ligne = (await db.query("select ends_on from study.group_memberships where group_id = $1 and profile_id = $2", [g1, ACTEURS.eleveA1Rayan])).rows;
  assert.equal(ligne.length, 1, "la ligne demeure");
  assert.notEqual(ligne[0].ends_on, null, "elle est datée de fin");
  assert.equal((await db.query("select * from study.etab_groupe_membres($1, $2)", [ACTEURS.adminA, g1])).rows.length, 0, "plus de membre actif");

  // Réajouter après un départ crée une nouvelle période, sans heurter l'unicité.
  assert.equal((await db.query("select study.etab_groupe_ajouter_eleves($1, $2, $3) as n", [ACTEURS.adminA, g1, [ACTEURS.eleveA1Rayan]])).rows[0].n, 1);
});

test("GROUPE-03 — rien ne traverse la frontière d'un établissement", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());
  const an = await annee(db, ACTEURS.adminA);
  const groupe = (await db.query("select study.etab_creer_groupe($1, $2, 'Euro', 'interclasses') as id", [ACTEURS.adminA, an])).rows[0].id;

  // Un élève du lycée B ne peut pas entrer dans un groupe du lycée A.
  const eleveB = await doitEchouer(() => db.query("select study.etab_groupe_ajouter_eleves($1, $2, $3)", [ACTEURS.adminA, groupe, [ACTEURS.eleveB]]));
  assert.match(eleveB.message, /non eleve/);

  // Un professeur n'administre pas (etab_contexte le refuse).
  const parProf = await doitEchouer(() => db.query("select study.etab_creer_groupe($1, $2, 'X', 'interclasses')", [ACTEURS.profMartin, an]));
  assert.match(parProf.message, /non habilite/);

  // L'admin du lycée B ne voit pas le groupe du lycée A.
  assert.equal((await db.query("select count(*)::int n from study.etab_groupes($1) where id = $2", [ACTEURS.adminB, groupe])).rows[0].n, 0);

  // Un type de groupe inconnu est refusé.
  const kind = await doitEchouer(() => db.query("select study.etab_creer_groupe($1, $2, 'Y', 'inconnu')", [ACTEURS.adminA, an]));
  assert.match(kind.message, /type de groupe/);
});

test("GROUPE-04 — aucune fonction de groupe n'est exécutable sans compte", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());
  const fns = [
    "study.etab_creer_groupe(uuid, uuid, text, text)",
    "study.etab_groupe_ajouter_eleves(uuid, uuid, uuid[])",
    "study.etab_groupe_retirer_eleve(uuid, uuid, uuid)",
    "study.etab_affecter_professeur_groupe(uuid, uuid, uuid, uuid, uuid)",
    "study.etab_groupes(uuid)",
    "study.etab_groupe_membres(uuid, uuid)",
    "study.etab_groupe_cours(uuid, uuid)",
  ];
  for (const f of fns) {
    for (const role of ["anon", "authenticated"]) {
      assert.equal((await db.query("select has_function_privilege($1, $2, 'execute') as ok", [role, f])).rows[0].ok, false, `${role} ne peut pas ${f}`);
    }
    assert.equal((await db.query("select has_function_privilege('service_role', $1, 'execute') as ok", [f])).rows[0].ok, true, `service_role exécute ${f}`);
  }
});
