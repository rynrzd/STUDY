// =============================================================================
// 0068 — Fiche élève : relire, changer de classe à une date, départ (cahier
// des charges ch. 09). Jamais deux classes principales actives le même jour ;
// les groupes ne suivent pas la classe ; rien n'est supprimé de l'historique.
// =============================================================================

import { test } from "node:test";
import assert from "node:assert/strict";
import { ACTEURS, OBJETS, baseDeTest, doitEchouer, lirePourAdmin } from "./harness.mjs";

const fiche = async (db, eleve, acteur = ACTEURS.adminA) => (await db.query("select study.etab_fiche_eleve($1, $2) as f", [acteur, eleve])).rows[0].f;
const changer = async (db, eleve, classe, date = null) => (await db.query("select study.etab_changer_classe($1, $2, $3, $4::date) as r", [ACTEURS.adminA, eleve, classe, date])).rows[0].r;
async function voit(db, eleve, espace) {
  await db.exec("set role authenticated;");
  await db.query("select set_config('study.user_id', $1, false)", [eleve]);
  try {
    return (await db.query("select study.attends_space($1) as v", [espace])).rows[0].v;
  } finally {
    await db.exec("reset role; select set_config('study.user_id', '', false);");
  }
}

test("FICHE-01 — la fiche dit la classe, les groupes, les cours visibles et l'historique", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());
  const f = await fiche(db, ACTEURS.eleveA1Rayan);
  assert.equal(f.identite.identifiant, "rayan.dupont");
  assert.equal(f.classe.id, OBJETS.classeA1);
  assert.equal(f.classe.label, "Seconde 1");
  assert.equal(f.groupes.length, 1);
  assert.equal(f.groupes[0].actif, true);
  assert.equal(f.cours.length, 2, "Mathématiques en Seconde 1 et le cours du groupe");
  assert.deepEqual(f.cours.map((c) => c.genre).sort(), ["classe", "groupe"]);
  assert.equal(f.inscriptions.length, 1);

  assert.match((await doitEchouer(() => fiche(db, ACTEURS.eleveA1Rayan, ACTEURS.adminB))).message, /hors de l etablissement/, "l'admin du lycée B ne lit pas la fiche");
  assert.match((await doitEchouer(() => fiche(db, ACTEURS.eleveA1Rayan, ACTEURS.profMartin))).message, /non habilite/);
  assert.match((await doitEchouer(() => fiche(db, ACTEURS.profMartin))).message, /hors de l etablissement/, "un professeur n'a pas de fiche élève");
});

test("FICHE-02 — l'aperçu d'un changement dit ce qui est perdu, gagné et gardé", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());
  const r = (await db.query("select * from study.etab_apercu_changement_classe($1, $2, $3)", [ACTEURS.adminA, ACTEURS.eleveA1Rayan, OBJETS.classeA2])).rows;
  const par = (m) => r.filter((x) => x.mouvement === m).map((x) => x.cible);
  assert.deepEqual(par("perdu"), ["Seconde 1"]);
  assert.deepEqual(par("gagne"), ["Seconde 2"]);
  assert.equal(par("garde").length, 1, "le groupe reste");
});

test("FICHE-03 — changer de classe : l'ancienne se ferme la veille, la nouvelle s'ouvre, le groupe reste", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());

  assert.equal(await changer(db, ACTEURS.eleveA1Rayan, OBJETS.classeA2), "deplacee");
  assert.equal(await voit(db, ACTEURS.eleveA1Rayan, OBJETS.espaceMathsA2), true, "nouvelle classe visible aujourd'hui");
  assert.equal(await voit(db, ACTEURS.eleveA1Rayan, OBJETS.espaceMathsA1), false, "ancienne classe fermée : pas deux classes le même jour");
  assert.equal(await voit(db, ACTEURS.eleveA1Rayan, OBJETS.espaceSpecialite), true, "le groupe ne suit pas la classe");

  const lignes = (await db.query("select class_id, starts_on::text, ends_on::text from study.class_enrollments where profile_id = $1 order by starts_on", [ACTEURS.eleveA1Rayan])).rows;
  assert.equal(lignes.length, 2, "l'ancienne inscription est gardée, datée");
  assert.notEqual(lignes[0].ends_on, null);

  // Erreur rectifiée le jour même : on corrige, on n'empile pas.
  assert.equal(await changer(db, ACTEURS.eleveA1Rayan, OBJETS.classeA1), "corrigee");
  assert.equal((await db.query("select count(*)::int n from study.class_enrollments where profile_id = $1", [ACTEURS.eleveA1Rayan])).rows[0].n, 2);
  assert.equal(await changer(db, ACTEURS.eleveA1Rayan, OBJETS.classeA1), "deja");

  // Changement daté dans le futur : rien ne bouge avant la date.
  assert.equal(await changer(db, ACTEURS.eleveA1Lina, OBJETS.classeA2, (await db.query("select (current_date + 7)::text d")).rows[0].d), "deplacee");
  assert.equal(await voit(db, ACTEURS.eleveA1Lina, OBJETS.espaceMathsA1), true, "encore en Seconde 1 jusqu'à la date");
  assert.equal(await voit(db, ACTEURS.eleveA1Lina, OBJETS.espaceMathsA2), false);
  const f = await fiche(db, ACTEURS.eleveA1Lina);
  assert.equal(f.classe_a_venir.label, "Seconde 2");

  // Une classe d'une autre année ou d'un autre lycée est refusée.
  const [{ annee_preparer: suivante }] = await lirePourAdmin(db, ACTEURS.adminA, "select study.annee_preparer('2027-2028', '2027-09-01', '2028-07-05')");
  const future = (await db.query("select study.etab_creer_classe($1, $2, 'Première 1') as id", [ACTEURS.adminA, suivante])).rows[0].id;
  assert.match((await doitEchouer(() => changer(db, ACTEURS.eleveA2Samir, future))).message, /autre annee/);
  assert.match((await doitEchouer(() => changer(db, ACTEURS.eleveA2Samir, OBJETS.classeB1))).message, /hors de l etablissement/);
});

test("FICHE-04 — départ : classe et groupes clos à la date, rien de supprimé, plus d'accès", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());
  const avant = (await db.query("select (select count(*) from study.class_enrollments where profile_id = $1)::int c, (select count(*) from study.group_memberships where profile_id = $1)::int g", [ACTEURS.eleveA2Samir])).rows[0];

  const r = (await db.query("select study.etab_depart_eleve($1, $2, (current_date - 1)) as r", [ACTEURS.adminA, ACTEURS.eleveA2Samir])).rows[0].r;
  assert.deepEqual(r, { classes: 1, groupes: 1 });
  assert.equal(await voit(db, ACTEURS.eleveA2Samir, OBJETS.espaceMathsA2), false);
  assert.equal(await voit(db, ACTEURS.eleveA2Samir, OBJETS.espaceSpecialite), false);

  const apres = (await db.query("select (select count(*) from study.class_enrollments where profile_id = $1)::int c, (select count(*) from study.group_memberships where profile_id = $1)::int g", [ACTEURS.eleveA2Samir])).rows[0];
  assert.deepEqual(apres, avant, "les lignes restent, datées");
  const f = await fiche(db, ACTEURS.eleveA2Samir);
  assert.equal(f.classe, null);
  assert.equal(f.cours.length, 0);
  assert.ok(f.groupes.every((g) => g.actif === false));
});

test("FICHE-05 — aucune de ces fonctions n'est exécutable sans compte", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());
  for (const f of [
    "study.etab_eleve_de(uuid, uuid)",
    "study.etab_fiche_eleve(uuid, uuid)",
    "study.etab_apercu_changement_classe(uuid, uuid, uuid)",
    "study.etab_changer_classe(uuid, uuid, uuid, date)",
    "study.etab_depart_eleve(uuid, uuid, date)",
  ]) {
    for (const role of ["anon", "authenticated"]) {
      assert.equal((await db.query("select has_function_privilege($1, $2, 'execute') as ok", [role, f])).rows[0].ok, false, `${role} : ${f}`);
    }
  }
});
