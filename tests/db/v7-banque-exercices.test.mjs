// =============================================================================
// Study V7 — banque d'exercices transversale (migration 0060, écran T04).
// Recette : droits source et cible, copie non publiée avec corrigé, source
// intacte, idempotence, corrigé invisible pour l'élève, autre lycée refusé.
// =============================================================================

import { test } from "node:test";
import assert from "node:assert/strict";
import { ACTEURS, OBJETS, baseDeTest, doitEchouer, enTantQue, lirePour } from "./harness.mjs";

async function exercicePublie(db) {
  return enTantQue(db, ACTEURS.profMartin, async (d) => {
    const ex = (
      await d.query(
        "insert into study.exercices (organization_id, teaching_space_id, lesson_id, created_by) values ($1, $2, $3, $4) returning id",
        [ACTEURS.lyceeA, OBJETS.espaceMathsA1, OBJETS.seanceA1, ACTEURS.profMartin],
      )
    ).rows[0].id;
    const v = (
      await d.query(
        "insert into study.exercice_versions (organization_id, exercice_id, kind, enonce, choix, difficulte, created_by) values ($1, $2, 'qcm', 'Image de 3 par f(x) = 2x + 1 ?', $3, 2, $4) returning id",
        [ACTEURS.lyceeA, ex, JSON.stringify(["5", "7", "9"]), ACTEURS.profMartin],
      )
    ).rows[0].id;
    await d.query(
      "insert into study.exercice_corriges (exercice_version_id, organization_id, bonne_reponse, explication, indice) values ($1, $2, $3, 'On remplace x par 3.', 'Remplace x.')",
      [v, ACTEURS.lyceeA, JSON.stringify({ index: 1 })],
    );
    await d.query("select study.exercice_publier($1)", [v]);
    return { ex, v };
  });
}

test("Banque : ajouter un exercice à une autre séance = copie non publiée, corrigé compris, sous droits", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());
  const { ex, v } = await exercicePublie(db);
  // Une séance dans l'autre classe du même professeur.
  const lecon = (
    await db.query(
      "insert into study.lessons (organization_id, teaching_space_id, title, work_mode, state, created_by) values ($1, $2, 'Séance A2', 'mixte', 'brouillon', $3) returning id",
      [ACTEURS.lyceeA, OBJETS.espaceMathsA2, ACTEURS.profMartin],
    )
  ).rows[0].id;

  const [{ exercice_ajouter_a_seance: copie }] = await lirePour(db, ACTEURS.profMartin, "select study.exercice_ajouter_a_seance($1, $2)", [v, lecon]);
  const [{ exercice_ajouter_a_seance: encore }] = await lirePour(db, ACTEURS.profMartin, "select study.exercice_ajouter_a_seance($1, $2)", [v, lecon]);
  assert.equal(encore, copie, "ajouter deux fois rend la même copie");

  const copieVersion = (await db.query("select id, enonce, published_at, difficulte from study.exercice_versions where exercice_id = $1", [copie])).rows;
  assert.equal(copieVersion.length, 1);
  assert.equal(copieVersion[0].published_at, null, "la copie n'est pas publiée : le professeur la relit");
  assert.equal(copieVersion[0].enonce, "Image de 3 par f(x) = 2x + 1 ?");
  const corrige = (await db.query("select explication, bonne_reponse from study.exercice_corriges where exercice_version_id = $1", [copieVersion[0].id])).rows[0];
  assert.equal(corrige.explication, "On remplace x par 3.");
  const [e] = (await db.query("select teaching_space_id, lesson_id, source_version_id from study.exercices where id = $1", [copie])).rows;
  assert.deepEqual([e.teaching_space_id, e.lesson_id, e.source_version_id], [OBJETS.espaceMathsA2, lecon, v]);
  const source = (await db.query("select count(*)::int as n from study.exercice_versions where exercice_id = $1", [ex])).rows[0].n;
  assert.equal(source, 1, "la source n'est pas modifiée");

  // Élève : aucun corrigé de la copie, ni de la source.
  const vuEleve = await lirePour(db, ACTEURS.eleveA2Samir, "select * from study.exercice_corriges where exercice_version_id = $1", [copieVersion[0].id]);
  assert.equal(vuEleve.length, 0);
  const refusEleve = await doitEchouer(() => lirePour(db, ACTEURS.eleveA1Rayan, "select study.exercice_ajouter_a_seance($1, $2)", [v, lecon]));
  assert.match(refusEleve.message, /NON_ACCESSIBLE/);

  // Professeur qui n'enseigne pas la source : refusé.
  const refusProf = await doitEchouer(() => lirePour(db, ACTEURS.profAutre, "select study.exercice_ajouter_a_seance($1, $2)", [v, lecon]));
  assert.match(refusProf.message, /NON_ACCESSIBLE/);
  // Cible dans un autre lycée : refusée.
  const refusLycee = await doitEchouer(() => lirePour(db, ACTEURS.profMartin, "select study.exercice_ajouter_a_seance($1, $2)", [v, OBJETS.seanceB1]));
  assert.match(refusLycee.message, /NON_ACCESSIBLE/);
  const [{ n }] = (await db.query("select count(*)::int as n from study.audit_events where action = 'exercice_ajoute_depuis_banque'")).rows;
  assert.equal(n, 1, "une seule copie journalisée");
});
