// =============================================================================
// 0070 — Programmer une publication (cahier des charges ch. 14). Rien n'est
// visible avant l'heure ; à l'heure, la séance devient publiée ; une
// programmation s'annule ; une séance déjà visible n'est pas re-programmée.
// =============================================================================

import { test } from "node:test";
import assert from "node:assert/strict";
import { ACTEURS, OBJETS, baseDeTest, doitEchouer, enTantQue, lirePour } from "./harness.mjs";

const A1 = OBJETS.espaceMathsA1;
const A2 = OBJETS.espaceMathsA2;
const GROUPE = OBJETS.espaceSpecialite;

async function serveur(db, travail) {
  await db.exec("set role service_role;");
  try {
    return await travail();
  } finally {
    await db.exec("reset role;");
  }
}

async function documentPret(db) {
  return enTantQue(db, ACTEURS.profMartin, async () => {
    const v = await db.query(
      "insert into study.content_versions (organization_id, body, version_number, created_by) values ($1, '{\"document\":{\"blocs\":[]}}'::jsonb, 1, $2) returning id",
      [ACTEURS.lyceeA, ACTEURS.profMartin],
    );
    const d = await db.query(
      "insert into study.studio_documents (organization_id, owner_id, title, state, current_revision_id) values ($1, $2, 'Les suites', 'a_verifier', $3) returning id",
      [ACTEURS.lyceeA, ACTEURS.profMartin, v.rows[0].id],
    );
    return d.rows[0].id;
  });
}

const programmer = (db, document, cours, quand = "now() + interval '1 day'") =>
  serveur(db, async () => (await db.query(`select * from study.studio_programmer_plusieurs($1, $2, $3, 'Les suites', ${quand})`, [ACTEURS.profMartin, document, cours])).rows);
const visibles = async (db, eleve, document) => (await lirePour(db, eleve, "select teaching_space_id from study.lessons where origin_studio_document = $1", [document])).map((r) => r.teaching_space_id).sort();
const cibles = (db, document) => serveur(db, async () => (await db.query("select * from study.studio_cibles_publication($1, $2)", [ACTEURS.profMartin, document])).rows);

test("PROG-01 — programmée pour demain : aucun élève ne la voit aujourd'hui", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());
  const document = await documentPret(db);

  const r = await programmer(db, document, [A1, GROUPE]);
  assert.ok(r.every((x) => x.resultat === "programmee" && x.seance !== null), JSON.stringify(r));
  assert.deepEqual(await visibles(db, ACTEURS.eleveA1Rayan, document), [], "rien de visible avant l'heure");
  assert.deepEqual(await visibles(db, ACTEURS.eleveA1Lina, document), []);

  const c = await cibles(db, document);
  const a1 = c.find((x) => x.teaching_space_id === A1);
  assert.notEqual(a1.programmee_pour, null);
  assert.equal(a1.deja_publie, false, "programmé n'est pas « déjà publié »");

  const pub = (await db.query("select published_at > now() as futur from study.lesson_publications where lesson_id = $1", [r[0].seance])).rows[0];
  assert.equal(pub.futur, true, "la trace de publication porte la date prévue");
});

test("PROG-02 — l'heure venue, la séance devient publiée, à la date prévue", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());
  const document = await documentPret(db);
  await programmer(db, document, [A1, GROUPE]);

  // L'heure arrive (on avance la date prévue plutôt que l'horloge).
  await db.query("update study.lessons set scheduled_for = now() - interval '1 minute' where origin_studio_document = $1", [document]);
  const n = await serveur(db, async () => (await db.query("select study.publier_seances_echues() as n")).rows[0].n);
  assert.equal(n, 2);
  assert.deepEqual(await visibles(db, ACTEURS.eleveA1Rayan, document), [A1, GROUPE].sort());
  assert.deepEqual(await visibles(db, ACTEURS.eleveA1Lina, document), [A1], "Lina : sa classe seulement");
  const etat = (await db.query("select state, published_at = scheduled_for as a_l_heure from study.lessons where origin_studio_document = $1 limit 1", [document])).rows[0];
  assert.equal(etat.state, "publiee");
  assert.equal(etat.a_l_heure, true);
  assert.equal(await serveur(db, async () => (await db.query("select study.publier_seances_echues() as n")).rows[0].n), 0, "rejouer ne fait rien");
});

test("PROG-03 — annuler avant l'heure : brouillon, publication à venir retirée", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());
  const document = await documentPret(db);
  const [r] = await programmer(db, document, [A1]);

  await serveur(db, () => db.query("select study.studio_annuler_programmation($1, $2)", [ACTEURS.profMartin, r.seance]));
  const l = (await db.query("select state, scheduled_for from study.lessons where id = $1", [r.seance])).rows[0];
  assert.equal(l.state, "brouillon");
  assert.equal(l.scheduled_for, null);
  assert.equal((await db.query("select count(*)::int n from study.lesson_publications where lesson_id = $1 and withdrawn_at is null", [r.seance])).rows[0].n, 0);
  await db.query("update study.lessons set scheduled_for = now() - interval '1 minute' where id = $1", [r.seance]);
  await serveur(db, () => db.query("select study.publier_seances_echues()"));
  assert.deepEqual(await visibles(db, ACTEURS.eleveA1Lina, document), [], "une programmation annulée ne part jamais");

  const a1 = (await cibles(db, document)).find((x) => x.teaching_space_id === A1);
  assert.equal(a1.programmee_pour, null);
  assert.equal(a1.version_a_jour, false);

  assert.match((await doitEchouer(() => serveur(db, () => db.query("select study.studio_annuler_programmation($1, $2)", [ACTEURS.profAutre, r.seance])))).message, /introuvable/);
});

test("PROG-04 — une séance déjà visible n'est pas re-programmée ; une date passée est refusée", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());
  const document = await documentPret(db);
  await serveur(db, () => db.query("select * from study.studio_publier_plusieurs($1, $2, $3, 'Les suites')", [ACTEURS.profMartin, document, [A1]]));

  const r = await programmer(db, document, [A1, A2]);
  const parCible = Object.fromEntries(r.map((x) => [x.cible, x]));
  assert.equal(parCible[A1].resultat, "refusee");
  assert.equal(parCible[A1].raison, "deja_visible");
  assert.equal(parCible[A2].resultat, "programmee");
  assert.deepEqual(await visibles(db, ACTEURS.eleveA1Lina, document), [A1], "la séance visible l'est toujours");

  assert.match((await doitEchouer(() => programmer(db, document, [A2], "now() - interval '1 hour'"))).message, /passee/);
});

test("PROG-05 — droits", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());
  for (const f of ["study.studio_programmer_plusieurs(uuid, uuid, uuid[], text, timestamptz)", "study.publier_seances_echues()", "study.studio_annuler_programmation(uuid, uuid)", "study.studio_cibles_publication(uuid, uuid)"]) {
    for (const role of ["anon", "authenticated"]) {
      assert.equal((await db.query("select has_function_privilege($1, $2, 'execute') as ok", [role, f])).rows[0].ok, false, `${role} : ${f}`);
    }
  }
});
