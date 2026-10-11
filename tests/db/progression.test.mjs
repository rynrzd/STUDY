// =============================================================================
// « Où j'en suis » (src/lib/v6/progression.ts) : rejoue les lectures sous le
// rôle de l'élève. Ses états de révision lui sont lisibles ; ceux d'un
// camarade ne le sont pas, même en les demandant explicitement ; les notions
// et leur matière sont lisibles pour ses cours.
// =============================================================================

import { test } from "node:test";
import assert from "node:assert/strict";
import { ACTEURS, OBJETS, baseDeTest, lirePour } from "./harness.mjs";

test("PROGRESSION-01 — états de révision : les siens seulement ; notions et matières lisibles", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());

  const espace = (await db.query("select organization_id from study.teaching_spaces where id = $1", [OBJETS.espaceMathsA1])).rows[0];
  const notion = (
    await db.query(
      "insert into study.notions (organization_id, teaching_space_id, label, created_by) values ($1, $2, 'Images et antécédents', $3) returning id, organization_id",
      [espace.organization_id, OBJETS.espaceMathsA1, ACTEURS.profMartin],
    )
  ).rows[0];
  for (const [qui, statut] of [
    [ACTEURS.eleveA1Rayan, "en_cours"],
    [ACTEURS.eleveA1Lina, "a_revoir"],
  ]) {
    await db.query(
      "insert into study.etats_revision (profile_id, notion_id, organization_id, statut, prochaine_revision) values ($1, $2, $3, $4, current_date + 2) on conflict do nothing",
      [qui, notion.id, notion.organization_id, statut],
    );
  }

  const miens = await lirePour(db, ACTEURS.eleveA1Rayan, "select notion_id, statut, prochaine_revision, rappels_actifs from study.etats_revision where profile_id = $1", [ACTEURS.eleveA1Rayan]);
  assert.equal(miens.length, 1);
  assert.equal(miens[0].statut, "en_cours");

  const ceuxDeLina = await lirePour(db, ACTEURS.eleveA1Rayan, "select statut from study.etats_revision where profile_id = $1", [ACTEURS.eleveA1Lina]);
  assert.equal(ceuxDeLina.length, 0, "les états d'un camarade ne sont pas lisibles");

  const tentativesDeLina = await lirePour(db, ACTEURS.eleveA1Rayan, "select id from study.tentatives where profile_id = $1", [ACTEURS.eleveA1Lina]);
  assert.equal(tentativesDeLina.length, 0, "les tentatives d'un camarade ne sont pas lisibles");

  const notions = await lirePour(
    db,
    ACTEURS.eleveA1Rayan,
    `select n.id, n.label, s.label as matiere
       from study.notions n
       left join study.teaching_spaces ts on ts.id = n.teaching_space_id
       left join study.subjects s on s.id = ts.subject_id
      where n.archived_at is null`,
  );
  assert.ok(notions.some((n) => n.id === notion.id), "la notion de son cours est lisible, avec sa matière");
});
