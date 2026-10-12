// =============================================================================
// 0067 — Affecter un professeur à plusieurs cours en une fois (cahier des
// charges, ch. 08). Couples explicites, jamais de produit cartésien ; issue
// rendue ligne par ligne ; rejeu sans doublon ; année prise de la cible.
// =============================================================================

import { test } from "node:test";
import assert from "node:assert/strict";
import { ACTEURS, OBJETS, baseDeTest, doitEchouer, lirePourAdmin } from "./harness.mjs";

const MATHS_A = "aaaaaaaa-3334-4000-8000-000000000001";
const MATHS_B = "bbbbbbbb-3334-4000-8000-000000000001";
const GROUPE_A = "aaaaaaaa-3333-4000-8000-000000000003";

const affecter = async (db, lignes, { acteur = ACTEURS.adminA, professeur = ACTEURS.profMartin } = {}) =>
  (await db.query("select * from study.etab_affecter_professeur_plusieurs($1, $2, $3::jsonb) order by rang", [acteur, professeur, JSON.stringify(lignes)])).rows;
const matiere = async (db, label) => (await db.query("select study.etab_creer_matiere($1, $2) as id", [ACTEURS.adminA, label])).rows[0].id;
const nbAffectations = async (db, prof) => (await db.query("select count(*)::int n from study.teacher_assignments where profile_id = $1 and ends_on is null", [prof])).rows[0].n;

test("AFF-01 — trois couples écrits : deux créés, un déjà existant, et rien d'autre", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());
  const physique = await matiere(db, "Physique-chimie");
  const avant = await nbAffectations(db, ACTEURS.profMartin);

  const r = await affecter(db, [
    { genre: "classe", cible: OBJETS.classeA1, matiere: physique },
    { genre: "groupe", cible: GROUPE_A, matiere: physique },
    { genre: "classe", cible: OBJETS.classeA1, matiere: MATHS_A },
  ]);
  assert.deepEqual(r.map((x) => [x.rang, x.resultat]), [[1, "creee"], [2, "creee"], [3, "existante"]]);
  assert.ok(r.every((x) => x.espace !== null));
  assert.equal(await nbAffectations(db, ACTEURS.profMartin), avant + 2, "seulement les couples demandés, pas de produit cartésien");

  const espaceGroupe = (await db.query("select class_id, group_id from study.teaching_spaces where id = $1", [r[1].espace])).rows[0];
  assert.equal(espaceGroupe.class_id, null);
  assert.equal(espaceGroupe.group_id, GROUPE_A);

  const trace = (await db.query("select metadata from study.audit_events where action = 'affectations_multiples' order by id desc limit 1")).rows[0].metadata;
  assert.deepEqual(trace, { lignes: 3, creees: 2, existantes: 1, refusees: 0 });
});

test("AFF-02 — rejouer la même demande ne crée rien", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());
  const svt = await matiere(db, "SVT");
  const lignes = [
    { genre: "classe", cible: OBJETS.classeA1, matiere: svt },
    { genre: "classe", cible: OBJETS.classeA2, matiere: svt },
  ];
  await affecter(db, lignes);
  const apresPremier = await nbAffectations(db, ACTEURS.profMartin);
  const rejeu = await affecter(db, lignes);
  assert.ok(rejeu.every((x) => x.resultat === "existante"));
  assert.equal(await nbAffectations(db, ACTEURS.profMartin), apresPremier);
});

test("AFF-03 — chaque ligne fautive est refusée seule, avec sa raison", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());
  const ses = await matiere(db, "SES");
  const archivee = (await db.query("select study.etab_creer_classe($1, (select academic_year_id from study.etab_contexte($1)), 'Ancienne 2nde') as id", [ACTEURS.adminA])).rows[0].id;
  await db.query("update study.classes set archived_at = now() where id = $1", [archivee]);

  const r = await affecter(db, [
    { genre: "classe", cible: OBJETS.classeB1, matiere: ses },
    { genre: "classe", cible: "pas-un-uuid", matiere: ses },
    { genre: "classe", cible: OBJETS.classeA2, matiere: ses },
    { genre: "classe", cible: OBJETS.classeA2, matiere: ses },
    { genre: "classe", cible: archivee, matiere: ses },
    { genre: "classe", cible: OBJETS.classeA1, matiere: MATHS_B },
    { genre: "salle", cible: OBJETS.classeA1, matiere: ses },
  ]);
  assert.deepEqual(
    r.map((x) => [x.resultat, x.raison]),
    [
      ["refusee", "cible_introuvable"],
      ["refusee", "ligne_invalide"],
      ["creee", null],
      ["refusee", "doublon_dans_la_demande"],
      ["refusee", "cible_introuvable"],
      ["refusee", "matiere_introuvable"],
      ["refusee", "ligne_invalide"],
    ],
  );
  // Aucun espace n'a été ouvert dans le lycée B ni sur la classe archivée.
  assert.equal((await db.query("select count(*)::int n from study.teaching_spaces where class_id in ($1, $2) and subject_id = $3", [OBJETS.classeB1, archivee, ses])).rows[0].n, 0);
});

test("AFF-04 — l'année du cours est celle de la classe, pas l'année courante", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());
  const [{ annee_preparer: suivante }] = await lirePourAdmin(db, ACTEURS.adminA, "select study.annee_preparer('2027-2028', '2027-09-01', '2028-07-05')");
  const classeSuivante = (await db.query("select study.etab_creer_classe($1, $2, '2nde 9') as id", [ACTEURS.adminA, suivante])).rows[0].id;

  const [r] = await affecter(db, [{ genre: "classe", cible: classeSuivante, matiere: MATHS_A }]);
  assert.equal(r.resultat, "creee");
  const annee = (await db.query("select academic_year_id from study.teaching_spaces where id = $1", [r.espace])).rows[0].academic_year_id;
  assert.equal(annee, suivante, "le cours appartient à l'année de sa classe");
});

test("AFF-05 — ce qui porte sur la demande fait échouer l'ensemble ; droits", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());
  const ligne = [{ genre: "classe", cible: OBJETS.classeA1, matiere: MATHS_A }];

  assert.match((await doitEchouer(() => affecter(db, ligne, { acteur: ACTEURS.profMartin }))).message, /non habilite/);
  assert.match((await doitEchouer(() => affecter(db, ligne, { professeur: ACTEURS.eleveA1Rayan }))).message, /non enseignant/);
  assert.match((await doitEchouer(() => affecter(db, ligne, { acteur: ACTEURS.adminB }))).message, /non enseignant/, "l'admin du lycée B ne peut pas affecter un professeur du lycée A");
  assert.match((await doitEchouer(() => affecter(db, []))).message, /aucune affectation/);

  const f = "study.etab_affecter_professeur_plusieurs(uuid, uuid, jsonb)";
  for (const role of ["anon", "authenticated"]) {
    assert.equal((await db.query("select has_function_privilege($1, $2, 'execute') as ok", [role, f])).rows[0].ok, false);
  }
  assert.equal((await db.query("select has_function_privilege('service_role', $1, 'execute') as ok", [f])).rows[0].ok, true);
});
