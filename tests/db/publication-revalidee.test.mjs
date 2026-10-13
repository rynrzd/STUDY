// =============================================================================
// 0081 — À l'heure dite, une séance programmée n'est publiée que si son
// auteur enseigne toujours le cours, et que le cours n'est pas archivé
// (SEC-07). Description facultative d'un groupe (GR-02).
// =============================================================================

import { test } from "node:test";
import assert from "node:assert/strict";
import { ACTEURS, OBJETS, baseDeTest, doitEchouer } from "./harness.mjs";

async function programmer(db, seance) {
  await db.query("update study.lessons set state = 'programmee', scheduled_for = now() - interval '1 minute', created_by = $2 where id = $1", [seance, ACTEURS.profMartin]);
}
const etat = async (db, seance) => (await db.query("select state from study.lessons where id = $1", [seance])).rows[0].state;

test("PUBR-01 — l'auteur enseigne toujours : la séance est publiée à l'heure", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());
  await programmer(db, OBJETS.seanceA1);
  await db.query("select study.publier_seances_echues()");
  assert.equal(await etat(db, OBJETS.seanceA1), "publiee");
});

test("PUBR-02 — l'auteur a quitté le cours : rien n'est publié, la programmation est annulée et journalisée", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());
  await programmer(db, OBJETS.seanceA1);
  await db.query("update study.teacher_assignments set ends_on = current_date - 1 where teaching_space_id = $1 and profile_id = $2", [OBJETS.espaceMathsA1, ACTEURS.profMartin]);
  const [{ publier_seances_echues: n }] = (await db.query("select study.publier_seances_echues()")).rows;
  assert.equal(n, 0);
  assert.equal(await etat(db, OBJETS.seanceA1), "brouillon");
  const j = (await db.query("select count(*)::int n from study.audit_events where object_id = $1 and action = 'publication_programmee_annulee'", [OBJETS.seanceA1])).rows[0].n;
  assert.equal(j, 1);
});

test("PUBR-03 — le cours a été archivé : rien n'est publié", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());
  await programmer(db, OBJETS.seanceA1);
  await db.query("update study.teaching_spaces set archived_at = now() where id = $1", [OBJETS.espaceMathsA1]);
  await db.query("select study.publier_seances_echues()");
  assert.equal(await etat(db, OBJETS.seanceA1), "brouillon");
});

test("GRD-01 — description d'un groupe : facultative, bornée, réservée à l'établissement", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());
  const r = (await db.query("select study.etab_groupe_decrire($1, $2, $3) as d", [ACTEURS.adminA, OBJETS.groupeSpecialite, "  Mardi et jeudi, salle B12  "])).rows[0].d;
  assert.equal(r, "Mardi et jeudi, salle B12");
  assert.equal((await db.query("select study.etab_groupe_description($1, $2) as d", [ACTEURS.adminA, OBJETS.groupeSpecialite])).rows[0].d, "Mardi et jeudi, salle B12");
  assert.equal((await db.query("select study.etab_groupe_decrire($1, $2, '') as d", [ACTEURS.adminA, OBJETS.groupeSpecialite])).rows[0].d, null, "vide : retirée");
  assert.match((await doitEchouer(() => db.query("select study.etab_groupe_decrire($1, $2, $3)", [ACTEURS.adminA, OBJETS.groupeSpecialite, "x".repeat(501)]))).message, /trop longue/);
  assert.match((await doitEchouer(() => db.query("select study.etab_groupe_decrire($1, $2, 'x')", [ACTEURS.adminB, OBJETS.groupeSpecialite]))).message, /hors de l etablissement/);
  assert.equal((await db.query("select study.etab_groupe_description($1, $2) as d", [ACTEURS.adminB, OBJETS.groupeSpecialite])).rows[0].d, null, "rien pour un autre lycée");
  for (const f of ["study.etab_groupe_decrire(uuid, uuid, text)", "study.etab_groupe_description(uuid, uuid)"]) {
    for (const role of ["anon", "authenticated"]) {
      assert.equal((await db.query("select has_function_privilege($1, $2, 'execute') as ok", [role, f])).rows[0].ok, false);
    }
  }
});
