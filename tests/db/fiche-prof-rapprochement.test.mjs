// =============================================================================
// 0080 — Fiche professeur (PROF-07), contrôle complété (ONB-05), rapprochement
// avant import (IMP-02, IMP-04), chapitres archivables (COURS-02).
// =============================================================================

import { test } from "node:test";
import assert from "node:assert/strict";
import { ACTEURS, OBJETS, baseDeTest, doitEchouer, lirePour } from "./harness.mjs";

test("FPR-01 — la fiche professeur : identité, affectations datées, professeur principal", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());
  await db.query("select study.etab_designer_professeur_principal($1, $2, $3)", [ACTEURS.adminA, OBJETS.classeA1, ACTEURS.profMartin]);
  const f = (await db.query("select study.etab_fiche_professeur($1, $2) as f", [ACTEURS.adminA, ACTEURS.profMartin])).rows[0].f;
  assert.ok(f.identite.identifiant);
  assert.ok(f.affectations.some((a) => a.espace === OBJETS.espaceMathsA1 && a.etat === "en_cours" && a.role));
  assert.deepEqual(f.principal_de.map((c) => c.id), [OBJETS.classeA1]);
  assert.match((await doitEchouer(() => db.query("select study.etab_fiche_professeur($1, $2)", [ACTEURS.adminA, ACTEURS.eleveA1Rayan]))).message, /hors de l etablissement/);
  assert.match((await doitEchouer(() => db.query("select study.etab_fiche_professeur($1, $2)", [ACTEURS.adminB, ACTEURS.profMartin]))).message, /hors de l etablissement/);
});

test("FPR-02 — contrôle : comptes suspendus et séances d'un professeur qui n'enseigne plus le cours", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());
  const avant = (await db.query("select study.etab_controle_complement($1) as r", [ACTEURS.adminA])).rows[0].r;
  await db.query("update study.organization_memberships set account_state = 'suspendu' where profile_id = $1", [ACTEURS.eleveA1Lina]);
  await db.query("update study.teacher_assignments set ends_on = current_date - 1 where teaching_space_id = $1 and profile_id = $2", [OBJETS.espaceMathsA1, ACTEURS.profMartin]);
  const apres = (await db.query("select study.etab_controle_complement($1) as r", [ACTEURS.adminA])).rows[0].r;
  assert.equal(apres.comptes_suspendus.n, avant.comptes_suspendus.n + 1);
  assert.ok(apres.publications_non_autorisees.n > avant.publications_non_autorisees.n, "la séance publiée de l'ancien professeur est signalée");
});

async function lot(db, lignes) {
  const annee = (await db.query("select academic_year_id from study.classes where id = $1", [OBJETS.classeA1])).rows[0].academic_year_id;
  // Un seul lot ouvert par établissement : le précédent est abandonné.
  await db.query("update study.import_batches set state = 'abandonne' where organization_id = $1 and state not in ('applique', 'abandonne')", [ACTEURS.lyceeA]);
  const id = (await db.query("insert into study.import_batches (organization_id, academic_year_id, kind, created_by) values ($1, $2, 'eleves', $3) returning id", [ACTEURS.lyceeA, annee, ACTEURS.adminA])).rows[0].id;
  const job = (await db.query(
    "insert into study.import_jobs (organization_id, academic_year_id, kind, state, created_by, batch_id, file_name, mapping, rows_total) values ($1, $2, 'eleves', 'apercu_pret', $3, $4, 'f.csv', '{}', $5) returning id",
    [ACTEURS.lyceeA, annee, ACTEURS.adminA, id, lignes.length],
  )).rows[0].id;
  for (const [i, p] of lignes.entries()) {
    await db.query("insert into study.import_rows (organization_id, import_job_id, row_number, payload, state) values ($1, $2, $3, $4, 'valide')", [ACTEURS.lyceeA, job, i + 2, JSON.stringify(p)]);
  }
  return id;
}

test("FPR-03 — rapprochement : nouveau, existant, homonymes en conflit, jamais fusionnés d'office", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());
  const qui = async (id) => (await db.query("select p.first_name, p.last_name, c.label from study.profiles p join study.class_enrollments ce on ce.profile_id = p.id and ce.ends_on is null join study.classes c on c.id = ce.class_id where p.id = $1", [id])).rows[0];
  const rayan = await qui(ACTEURS.eleveA1Rayan);
  const homo = await qui(ACTEURS.eleveA1Homonyme1);
  const id = await lot(db, [
    { prenom: "Zoé", nom: "Inédite", classe: "Seconde 1", identifiantExterne: null },
    { prenom: rayan.first_name, nom: rayan.last_name, classe: rayan.label, identifiantExterne: null },
    { prenom: homo.first_name, nom: homo.last_name, classe: homo.label, identifiantExterne: null },
  ]);
  const r = (await db.query("select * from study.etab_lot_rapprochement($1, $2) order by numero", [ACTEURS.adminA, id])).rows;
  assert.deepEqual(r.map((x) => x.statut), ["nouveau", "existant", "conflit"], "deux élèves portent ce nom : on demande, on ne choisit pas");

  // Un INE connu certifie la personne : changement de classe, pas conflit.
  await db.query("insert into study.external_identities (organization_id, profile_id, source, external_id) values ($1, $2, 'import_eleves', 'INE-RAYAN')", [ACTEURS.lyceeA, ACTEURS.eleveA1Rayan]);
  const id2 = await lot(db, [{ prenom: rayan.first_name, nom: rayan.last_name, classe: "Seconde 2", identifiantExterne: "INE-RAYAN" }]);
  assert.equal((await db.query("select statut from study.etab_lot_rapprochement($1, $2)", [ACTEURS.adminA, id2])).rows[0].statut, "reinscription");
  // Même nom, autre classe, sans INE : conflit.
  const id3 = await lot(db, [{ prenom: rayan.first_name, nom: rayan.last_name, classe: "Seconde 2", identifiantExterne: null }]);
  assert.equal((await db.query("select statut from study.etab_lot_rapprochement($1, $2)", [ACTEURS.adminA, id3])).rows[0].statut, "conflit");

  assert.match((await doitEchouer(() => db.query("select * from study.etab_lot_rapprochement($1, $2)", [ACTEURS.adminB, id]))).message, /hors de l etablissement/);
  for (const f of ["study.etab_fiche_professeur(uuid, uuid)", "study.etab_controle_complement(uuid)", "study.etab_lot_rapprochement(uuid, uuid)"]) {
    for (const role of ["anon", "authenticated"]) {
      assert.equal((await db.query("select has_function_privilege($1, $2, 'execute') as ok", [role, f])).rows[0].ok, false, `${role} ${f}`);
    }
  }
});

test("FPR-04 — un chapitre s'archive sans perdre ses séances", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());
  const [ch] = await lirePour(db, ACTEURS.profMartin, "insert into study.chapters (organization_id, teaching_space_id, label) values ($1, $2, 'Chapitre ancien') returning id", [ACTEURS.lyceeA, OBJETS.espaceMathsA1]);
  await lirePour(db, ACTEURS.profMartin, "update study.lessons set chapter_id = $1 where id = $2", [ch.id, OBJETS.seanceA1Brouillon]);
  const maj = await lirePour(db, ACTEURS.profMartin, "update study.chapters set archived_at = now() where id = $1 returning id", [ch.id]);
  assert.equal(maj.length, 1, "le professeur du cours archive son chapitre");
  assert.equal((await db.query("select chapter_id from study.lessons where id = $1", [OBJETS.seanceA1Brouillon])).rows[0].chapter_id, ch.id, "la séance reste rattachée");
  const autre = await lirePour(db, ACTEURS.profAutre, "update study.chapters set archived_at = null where id = $1 returning id", [ch.id]);
  assert.equal(autre.length, 0, "un collègue hors du cours ne touche à rien");
});
