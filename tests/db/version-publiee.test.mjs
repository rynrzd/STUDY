// =============================================================================
// 0083 — L'élève, la recherche et les fiches lisent la version publiée
// (PUB-07) ; favoris de cours (TEACH-17) ; copie de structure (COURS-08/09/15).
// =============================================================================

import { test } from "node:test";
import assert from "node:assert/strict";
import { ACTEURS, OBJETS, baseDeTest, doitEchouer, lirePour } from "./harness.mjs";

async function seancePubliee(db, texte) {
  const [l] = await lirePour(db, ACTEURS.profMartin, "insert into study.lessons (organization_id, teaching_space_id, title, created_by) values ($1, $2, 'Le second degré', $3) returning id", [ACTEURS.lyceeA, OBJETS.espaceMathsA1, ACTEURS.profMartin]);
  const [b] = await lirePour(db, ACTEURS.profMartin, "insert into study.lesson_blocks (organization_id, lesson_id, kind, position, contenu, created_by) values ($1, $2, 'texte', 1, $3, $4) returning id", [ACTEURS.lyceeA, l.id, JSON.stringify({ texte }), ACTEURS.profMartin]);
  const corps = { blocs: [{ id: b.id, kind: "texte", position: 1, contenu: { texte }, file_id: null, assignment_id: null }] };
  const [v] = await lirePour(db, ACTEURS.profMartin, "insert into study.content_versions (organization_id, body, version_number, sealed_at, created_by) values ($1, $2, 1, now(), $3) returning id", [ACTEURS.lyceeA, JSON.stringify(corps), ACTEURS.profMartin]);
  await lirePour(db, ACTEURS.profMartin, "update study.lessons set state = 'publiee', published_at = now(), content_version_id = $2 where id = $1", [l.id, v.id]);
  return { lecon: l.id, bloc: b.id };
}

test("VPUB-01 — une retouche après publication reste privée jusqu'à la prochaine publication", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());
  const { lecon, bloc } = await seancePubliee(db, "Version publiée");
  await lirePour(db, ACTEURS.profMartin, "update study.lesson_blocks set contenu = $2 where id = $1", [bloc, JSON.stringify({ texte: "Retouche en cours" })]);

  const passages = (await db.query("select texte, ref from study.passages_de_seance($1)", [lecon])).rows;
  assert.deepEqual(passages.map((p) => p.texte), ["Version publiée"], "recherche et fiches : la version publiée");
  assert.equal(passages[0].ref, `bloc:${bloc}`, "la référence du passage reste celle du bloc");

  const [{ b }] = await lirePour(db, ACTEURS.eleveA1Rayan, "select study.eleve_blocs_publies($1) as b", [lecon]);
  assert.equal(b[0].contenu.texte, "Version publiée", "l'élève lit la version publiée");
  assert.match((await doitEchouer(() => lirePour(db, ACTEURS.eleveA2Samir, "select study.eleve_blocs_publies($1)", [lecon]))).message, /NON_ACCESSIBLE/, "un élève d'une autre classe");

  // Un brouillon reste lu en direct (pour le professeur et son aperçu).
  await lirePour(db, ACTEURS.profMartin, "update study.lessons set state = 'brouillon', published_at = null where id = $1", [lecon]);
  assert.deepEqual((await db.query("select texte from study.passages_de_seance($1)", [lecon])).rows.map((p) => p.texte), ["Retouche en cours"]);
});

test("VPUB-02 — favoris de cours : à soi, et seulement pour ses cours", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());
  await lirePour(db, ACTEURS.profMartin, "insert into study.cours_favoris (profile_id, teaching_space_id) values ($1, $2)", [ACTEURS.profMartin, OBJETS.espaceMathsA1]);
  assert.equal((await lirePour(db, ACTEURS.profMartin, "select count(*)::int n from study.cours_favoris"))[0].n, 1);
  assert.equal((await lirePour(db, ACTEURS.profAutre, "select count(*)::int n from study.cours_favoris"))[0].n, 0, "invisible des autres");
  await doitEchouer(() => lirePour(db, ACTEURS.profMartin, "insert into study.cours_favoris (profile_id, teaching_space_id) values ($1, $2)", [ACTEURS.profMartin, OBJETS.espaceMathsB1]));
  await doitEchouer(() => lirePour(db, ACTEURS.profAutre, "insert into study.cours_favoris (profile_id, teaching_space_id) values ($1, $2)", [ACTEURS.profMartin, OBJETS.espaceMathsA1]));
});

test("VPUB-03 — copier la structure : chapitres seuls, séances en brouillon, ou publiées", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());
  await lirePour(db, ACTEURS.profMartin, "insert into study.chapters (organization_id, teaching_space_id, label, position) values ($1, $2, 'Chapitre 1 — Fonctions', 0)", [ACTEURS.lyceeA, OBJETS.espaceMathsA1]);
  await seancePubliee(db, "Cours publié");
  const avantA2 = (await db.query("select count(*)::int n from study.lessons where teaching_space_id = $1", [OBJETS.espaceMathsA2])).rows[0].n;

  const [{ r: s }] = await lirePour(db, ACTEURS.profMartin, "select study.prof_copier_structure($1, $2, 'structure') as r", [OBJETS.espaceMathsA1, OBJETS.espaceMathsA2]);
  assert.ok(s.chapitres >= 1);
  assert.equal(s.seances, 0);
  assert.equal((await db.query("select count(*)::int n from study.lessons where teaching_space_id = $1", [OBJETS.espaceMathsA2])).rows[0].n, avantA2);

  const [{ r: p }] = await lirePour(db, ACTEURS.profMartin, "select study.prof_copier_structure($1, $2, 'publier') as r", [OBJETS.espaceMathsA1, OBJETS.espaceMathsA2]);
  assert.equal(p.chapitres, 0, "le chapitre existe déjà : pas de doublon");
  assert.ok(p.seances >= 1);
  assert.ok(p.publiees >= 1);
  const devoirs = (await db.query("select count(*)::int n from study.lesson_blocks b join study.lessons l on l.id = b.lesson_id where l.teaching_space_id = $1 and b.kind = 'devoir'", [OBJETS.espaceMathsA2])).rows[0].n;
  assert.equal(devoirs, 0, "aucun devoir recopié");

  assert.match((await doitEchouer(() => lirePour(db, ACTEURS.profAutre, "select study.prof_copier_structure($1, $2, 'structure')", [OBJETS.espaceMathsA1, OBJETS.espaceMathsA2]))).message, /NON_ACCESSIBLE/);
  assert.equal((await db.query("select has_function_privilege('anon', 'study.prof_copier_structure(uuid, uuid, text)', 'execute') as ok")).rows[0].ok, false);
});
