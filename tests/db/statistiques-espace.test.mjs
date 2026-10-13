// =============================================================================
// 0084 — Statistiques par classe ou groupe (PED-10) et retraits immédiats.
// Agrégats seulement, masqués sous cinq élèves, réservés aux enseignants du
// cours ; un élève changé de classe ne voit plus l'ancienne dès le geste.
// =============================================================================

import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { ACTEURS, OBJETS, baseDeTest, doitEchouer, lirePour } from "./harness.mjs";

test("STATS-01 — agrégats réservés au professeur du cours, masqués sous cinq élèves", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());
  const lignes = await lirePour(db, ACTEURS.profMartin, "select * from study.prof_statistiques_espace($1)", [OBJETS.espaceMathsA1]);
  assert.ok(lignes.length >= 1, "les séances publiées apparaissent");
  const l = lignes.find((x) => x.lecon === OBJETS.seanceA1);
  assert.ok(l, "la séance publiée est listée");
  assert.ok(l.effectif >= 1, "l'effectif de la classe est donné");
  assert.equal(l.masque, true, "moins de cinq élèves : masqué");
  assert.equal(l.eleves_exercices, null);
  assert.ok(!lignes.some((x) => x.lecon === OBJETS.seanceA1Brouillon), "un brouillon n'apparaît pas");

  await doitEchouer(() => lirePour(db, ACTEURS.profAutre, "select * from study.prof_statistiques_espace($1)", [OBJETS.espaceMathsA1]));
  await doitEchouer(() => lirePour(db, ACTEURS.eleveA1Rayan, "select * from study.prof_statistiques_espace($1)", [OBJETS.espaceMathsA1]));
  await doitEchouer(() => lirePour(db, ACTEURS.profMartin, "select * from study.prof_statistiques_espace($1)", [OBJETS.espaceMathsB1]));
});

test("RETRAIT-01 — un changement de classe ferme l'ancienne classe tout de suite", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());
  // Inscription ancienne (commencée avant aujourd'hui) : elle est close la veille.
  await db.query("update study.class_enrollments set starts_on = current_date - 30 where profile_id = $1", [ACTEURS.eleveA1Lina]);
  await db.query("select study.etab_inscrire_eleve($1, $2, $3)", [ACTEURS.adminA, ACTEURS.eleveA1Lina, OBJETS.classeA2]);
  const ancienne = (await db.query("select ends_on, current_date - 1 as veille from study.class_enrollments where profile_id = $1 and class_id = $2", [ACTEURS.eleveA1Lina, OBJETS.classeA1])).rows[0];
  assert.equal(String(ancienne.ends_on), String(ancienne.veille), "close la veille, l'historique reste");
  const voitA1 = await lirePour(db, ACTEURS.eleveA1Lina, "select study.attends_space($1) as v", [OBJETS.espaceMathsA1]);
  assert.equal(voitA1[0].v, false, "plus d'accès à l'ancienne classe");
  const voitA2 = await lirePour(db, ACTEURS.eleveA1Lina, "select study.attends_space($1) as v", [OBJETS.espaceMathsA2]);
  assert.equal(voitA2[0].v, true, "accès à la nouvelle");
});

test("DEDUP-01 (DATA-11) — un fichier identique de la même personne est retrouvé, jamais celui d'un autre", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());
  const empreinte = "ab".repeat(32);
  const fichier = (await db.query(
    `insert into study.files (organization_id, owner_id, display_name, storage_key, byte_size, sha256, state, attached_kind)
     values ($1, $2, 'cours.pdf', $4, 10, decode($3, 'hex'), 'disponible', 'support_seance') returning id`,
    [ACTEURS.lyceeA, ACTEURS.profMartin, empreinte, `${ACTEURS.lyceeA}/${randomUUID()}/${randomUUID()}`],
  )).rows[0].id;
  const doc = (await db.query(
    `insert into study.studio_documents (organization_id, owner_id, title, source_file_id, state) values ($1, $2, 'Cours', $3, 'pret') returning id`,
    [ACTEURS.lyceeA, ACTEURS.profMartin, fichier],
  )).rows[0].id;

  const lui = await lirePour(db, ACTEURS.profMartin, "select study.prof_document_identique($1) as d", [empreinte]);
  assert.equal(lui[0].d, doc, "même auteur, même empreinte : le document existant");
  const autre = await lirePour(db, ACTEURS.profAutre, "select study.prof_document_identique($1) as d", [empreinte]);
  assert.equal(autre[0].d, null, "un autre professeur n'apprend rien du fichier");
  const differente = await lirePour(db, ACTEURS.profMartin, "select study.prof_document_identique($1) as d", ["cd".repeat(32)]);
  assert.equal(differente[0].d, null);
  const invalide = await lirePour(db, ACTEURS.profMartin, "select study.prof_document_identique($1) as d", ["pas-une-empreinte"]);
  assert.equal(invalide[0].d, null);
  await db.query("update study.studio_documents set archived_at = now() where id = $1", [doc]);
  assert.equal((await lirePour(db, ACTEURS.profMartin, "select study.prof_document_identique($1) as d", [empreinte]))[0].d, null, "archivé : nouveau dépôt");
});

test("EFFACEMENT-01 (SEC-18) — une demande ferme le compte, se journalise et s'annule", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());
  await doitEchouer(() => db.query("select study.etab_demander_effacement($1, $2, 'court')", [ACTEURS.adminA, ACTEURS.eleveA1Rayan]));
  const r = (await db.query("select study.etab_demander_effacement($1, $2, $3) as r", [ACTEURS.adminA, ACTEURS.eleveA1Rayan, "Demande écrite des parents du 12/10"])).rows[0].r;
  assert.equal(r, "demandee");
  assert.equal((await db.query("select study.etab_demander_effacement($1, $2, $3) as r", [ACTEURS.adminA, ACTEURS.eleveA1Rayan, "Demande écrite des parents du 12/10"])).rows[0].r, "deja");
  const etat = (await db.query("select account_state from study.organization_memberships where profile_id = $1", [ACTEURS.eleveA1Rayan])).rows[0].account_state;
  assert.equal(etat, "en_suppression");
  const voit = await lirePour(db, ACTEURS.eleveA1Rayan, "select study.attends_space($1) as v", [OBJETS.espaceMathsA1]);
  assert.equal(voit[0].v, false, "plus aucun accès");
  const liste = (await db.query("select * from study.etab_effacements_en_attente($1)", [ACTEURS.adminA])).rows;
  assert.deepEqual(liste.map((l) => l.profil), [ACTEURS.eleveA1Rayan]);
  assert.equal((await db.query("select * from study.etab_effacements_en_attente($1)", [ACTEURS.adminB])).rows.length, 0, "rien d'un autre lycée");
  const journal = (await db.query("select reason from study.audit_events where action = 'demande_effacement' and object_id = $1", [ACTEURS.eleveA1Rayan])).rows;
  assert.equal(journal.length, 1);

  // Hors établissement, sur un administrateur, ou sans droits : refusé.
  await doitEchouer(() => db.query("select study.etab_demander_effacement($1, $2, $3)", [ACTEURS.adminB, ACTEURS.eleveA1Lina, "Demande hors établissement"]));
  await doitEchouer(() => db.query("select study.etab_demander_effacement($1, $2, $3)", [ACTEURS.profMartin, ACTEURS.eleveA1Lina, "Un professeur n'administre pas"]));
  await doitEchouer(() => lirePour(db, ACTEURS.adminA, "select study.etab_demander_effacement($1, $2, $3)", [ACTEURS.adminA, ACTEURS.eleveA1Lina, "Appel direct par un compte"]));

  assert.equal((await db.query("select study.etab_annuler_effacement($1, $2) as r", [ACTEURS.adminA, ACTEURS.eleveA1Rayan])).rows[0].r, true);
  assert.equal((await db.query("select account_state from study.organization_memberships where profile_id = $1", [ACTEURS.eleveA1Rayan])).rows[0].account_state, "actif", "état d'avant retrouvé");
});
