// =============================================================================
// 0071 — Historique des versions d'un document du Studio (cahier des charges
// ch. 12, EDIT-09 ; T04-011). Toutes les versions se retrouvent ; on voit
// laquelle est en ligne et où ; restaurer crée une nouvelle version et ne
// change rien pour les élèves tant qu'on ne republie pas.
// =============================================================================

import { test } from "node:test";
import assert from "node:assert/strict";
import { ACTEURS, OBJETS, baseDeTest, doitEchouer, enTantQue, lirePour } from "./harness.mjs";

async function serveur(db, travail) {
  await db.exec("set role service_role;");
  try {
    return await travail();
  } finally {
    await db.exec("reset role;");
  }
}

/** Un document et trois versions enregistrées par l'éditeur (comme l'application, avec le lien vers le document). */
async function documentAvecVersions(db) {
  return enTantQue(db, ACTEURS.profMartin, async () => {
    const version = async (n, titre) =>
      (await db.query("insert into study.content_versions (organization_id, body, version_number, created_by, created_at) values ($1, $2::jsonb, $3::int, $4, now() - make_interval(secs => $5::int)) returning id", [
        ACTEURS.lyceeA,
        JSON.stringify({ document: { titre, blocs: [] } }),
        n,
        ACTEURS.profMartin,
        60 - n,
      ])).rows[0].id;
    const v1 = await version(1, "Suites — premier jet");
    const doc = (await db.query("insert into study.studio_documents (organization_id, owner_id, title, state, current_revision_id) values ($1, $2, 'Suites', 'a_verifier', $3) returning id", [ACTEURS.lyceeA, ACTEURS.profMartin, v1])).rows[0].id;
    const v2 = await version(2, "Suites — relu");
    const v3 = await version(3, "Suites — exemples ajoutés");
    await db.query("update study.content_versions set studio_document_id = $1 where id = any($2)", [doc, [v1, v2, v3]]);
    await db.query("update study.studio_documents set current_revision_id = $1 where id = $2", [v3, doc]);
    return { doc, v1, v2, v3 };
  });
}
const historique = (db, doc, acteur = ACTEURS.profMartin) => serveur(db, async () => (await db.query("select * from study.studio_historique($1, $2)", [acteur, doc])).rows);

test("VER-01 — toutes les versions se retrouvent, de la plus récente à la plus ancienne", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());
  const { doc, v1, v2, v3 } = await documentAvecVersions(db);
  const h = await historique(db, doc);
  assert.deepEqual(h.map((x) => x.version), [v3, v2, v1]);
  assert.deepEqual(h.map((x) => x.courante), [true, false, false]);
  assert.equal(h[2].titre, "Suites — premier jet");
});

test("VER-02 — on voit quelle version est en ligne, et dans quels cours", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());
  const { doc, v2, v3 } = await documentAvecVersions(db);
  // Publier la version 2 en Seconde 1, puis enregistrer la 3.
  await db.query("update study.studio_documents set current_revision_id = $1 where id = $2", [v2, doc]);
  await serveur(db, () => db.query("select study.studio_publier($1, $2, $3, 'Suites')", [ACTEURS.profMartin, doc, OBJETS.espaceMathsA1]));
  await db.query("update study.studio_documents set current_revision_id = $1 where id = $2", [v3, doc]);

  const h = await historique(db, doc);
  assert.deepEqual(h.find((x) => x.version === v2).en_ligne_dans, ["Mathematiques — Seconde 1"]);
  assert.deepEqual(h.find((x) => x.version === v3).en_ligne_dans, [], "la version de travail n'est en ligne nulle part");
});

test("VER-03 — restaurer crée une nouvelle version ; les élèves gardent la version publiée", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());
  const { doc, v1, v2, v3 } = await documentAvecVersions(db);
  await db.query("update study.studio_documents set current_revision_id = $1 where id = $2", [v2, doc]);
  const seance = (await serveur(db, async () => (await db.query("select study.studio_publier($1, $2, $3, 'Suites') as id", [ACTEURS.profMartin, doc, OBJETS.espaceMathsA1])).rows[0].id));
  await db.query("update study.studio_documents set current_revision_id = $1 where id = $2", [v3, doc]);

  const numero = await serveur(db, async () => (await db.query("select study.studio_restaurer_version($1, $2, $3) as n", [ACTEURS.profMartin, doc, v1])).rows[0].n);
  assert.equal(numero, 4);
  const h = await historique(db, doc);
  assert.equal(h.length, 4, "rien n'est effacé : une version de plus");
  assert.equal(h[0].courante, true);
  assert.equal(h[0].titre, "Suites — premier jet", "la nouvelle version recopie la première");

  const vue = await lirePour(db, ACTEURS.eleveA1Lina, "select content_version_id from study.lessons where id = $1", [seance]);
  assert.equal(vue[0].content_version_id, v2, "l'élève voit toujours la version publiée");
});

test("VER-04 — l'historique est à l'auteur seul ; une version d'un autre document est refusée", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());
  const { doc, v3 } = await documentAvecVersions(db);
  const autre = await documentAvecVersions(db);

  assert.match((await doitEchouer(() => historique(db, doc, ACTEURS.profAutre))).message, /introuvable/);
  assert.match((await doitEchouer(() => serveur(db, () => db.query("select study.studio_restaurer_version($1, $2, $3)", [ACTEURS.profAutre, doc, v3])))).message, /introuvable/);
  assert.match((await doitEchouer(() => serveur(db, () => db.query("select study.studio_restaurer_version($1, $2, $3)", [ACTEURS.profMartin, doc, autre.v1])))).message, /version introuvable/);
  assert.match((await doitEchouer(() => serveur(db, () => db.query("select study.studio_restaurer_version($1, $2, $3)", [ACTEURS.profMartin, doc, v3])))).message, /deja courante/);
});

test("VER-05 — droits", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());
  for (const f of ["study.studio_historique(uuid, uuid)", "study.studio_restaurer_version(uuid, uuid, uuid)"]) {
    for (const role of ["anon", "authenticated"]) {
      assert.equal((await db.query("select has_function_privilege($1, $2, 'execute') as ok", [role, f])).rows[0].ok, false);
    }
  }
});
