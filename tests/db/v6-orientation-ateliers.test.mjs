// =============================================================================
// Study V6 — orientation privee et ateliers (migration 0052).
// =============================================================================

import { test } from "node:test";
import assert from "node:assert/strict";
import { ACTEURS, OBJETS, baseDeTest, doitEchouer, lirePour, lirePourAdmin } from "./harness.mjs";

test("Orientation : privee, partagee piste par piste a un adulte qui encadre", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());
  const id = (
    await lirePour(
      db,
      ACTEURS.eleveA1Rayan,
      `insert into study.orientation_pistes (organization_id, owner_id, intitule, organisation)
       values ($1, $2, 'Stage en laboratoire', 'Laboratoire municipal') returning id`,
      [ACTEURS.lyceeA, ACTEURS.eleveA1Rayan],
    )
  )[0].id;

  for (const [qui, lire] of [
    [ACTEURS.eleveA1Lina, lirePour],
    [ACTEURS.profMartin, lirePour],
    [ACTEURS.adminA, lirePourAdmin],
  ]) {
    assert.equal((await lire(db, qui, "select 1 from study.orientation_pistes")).length, 0);
  }
  const versPair = await doitEchouer(() =>
    lirePour(db, ACTEURS.eleveA1Rayan, "select study.orientation_partager($1, $2)", [id, ACTEURS.eleveA1Lina]),
  );
  assert.match(versPair.message, /DESTINATAIRE_INVALIDE/);
  await lirePour(db, ACTEURS.eleveA1Rayan, "select study.orientation_partager($1, $2)", [id, ACTEURS.profMartin]);
  assert.equal((await lirePour(db, ACTEURS.profMartin, "select intitule from study.orientation_pistes"))[0].intitule, "Stage en laboratoire");
  const modifParProf = await lirePour(db, ACTEURS.profMartin, "update study.orientation_pistes set intitule = 'x' returning id");
  assert.equal(modifParProf.length, 0, "le destinataire lit, il ne modifie pas");

  const v = await lirePour(
    db,
    ACTEURS.eleveA1Rayan,
    "select study.orientation_modifier($1, 1, 'Stage en laboratoire', 'Labo', 'a_contacter', null, current_date + 10, 'appeler lundi') as v",
    [id],
  );
  assert.equal(v[0].v, 2);
  const conflit = await doitEchouer(() =>
    lirePour(db, ACTEURS.eleveA1Rayan, "select study.orientation_modifier($1, 1, 'x x', null, 'clos', null, null, null)", [id]),
  );
  assert.match(conflit.message, /VERSION_CONFLICT/);
});

test("Ateliers : sources exigees, reponses individuelles, corrige apres cloture, contestation", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());

  const id = (
    await lirePour(
      db,
      ACTEURS.profMartin,
      `insert into study.ateliers (organization_id, teaching_space_id, kind, titre, question, sources, created_by)
       values ($1, $2, 'actualite', 'Lire un graphique de presse', 'Le graphique montre-t-il une hausse ?',
               '[{"titre": "Article A", "auteur": "Journal A", "date": "2026-09-30"}]', $3) returning id`,
      [ACTEURS.lyceeA, OBJETS.espaceMathsA1, ACTEURS.profMartin],
    )
  )[0].id;
  assert.equal((await lirePour(db, ACTEURS.eleveA1Rayan, "select 1 from study.ateliers")).length, 0, "brouillon invisible");

  const uneSource = await doitEchouer(() => lirePour(db, ACTEURS.profMartin, "select study.atelier_etat($1, 'publie')", [id]));
  assert.match(uneSource.message, /ateliers_sources/, "au moins deux sources datees");
  await lirePour(
    db,
    ACTEURS.profMartin,
    `update study.ateliers set sources = sources || '[{"titre": "Article B", "auteur": "Journal B", "date": "2026-10-01"}]' where id = $1`,
    [id],
  );
  await lirePour(db, ACTEURS.profMartin, "insert into study.ateliers_corriges values ($1, 'La hausse est une interpretation de l''axe tronque.')", [id]);
  await lirePour(db, ACTEURS.profMartin, "select study.atelier_etat($1, 'publie')", [id]);

  const annotations = JSON.stringify([{ affirmation: "Les prix montent", categorie: "interpretation", justification: "axe tronque", source: 0 }]);
  const sansJustif = await doitEchouer(() =>
    lirePour(db, ACTEURS.eleveA1Rayan, "select study.atelier_repondre($1, $2, null, 0)", [
      id,
      JSON.stringify([{ affirmation: "x", categorie: "fait", justification: "" }]),
    ]),
  );
  assert.match(sansJustif.message, /ANNOTATION_INVALIDE/);
  await lirePour(db, ACTEURS.eleveA1Rayan, "select study.atelier_repondre($1, $2, null, 0)", [id, annotations]);

  assert.equal((await lirePour(db, ACTEURS.eleveA1Lina, "select 1 from study.ateliers_reponses")).length, 0, "reponses individuelles");
  assert.equal((await lirePour(db, ACTEURS.profMartin, "select 1 from study.ateliers_reponses")).length, 1);
  assert.equal((await lirePour(db, ACTEURS.eleveA1Rayan, "select 1 from study.ateliers_corriges")).length, 0, "corrige cache avant cloture");

  await lirePour(db, ACTEURS.profMartin, "select study.atelier_etat($1, 'clos')", [id]);
  assert.equal((await lirePour(db, ACTEURS.eleveA1Rayan, "select 1 from study.ateliers_corriges")).length, 1);
  assert.equal((await lirePour(db, ACTEURS.eleveA2Samir, "select 1 from study.ateliers_corriges")).length, 0);

  const v = await lirePour(db, ACTEURS.eleveA1Rayan, "select study.atelier_repondre($1, $2, 'Je conteste : la source B montre aussi une hausse.', 1) as v", [
    id,
    annotations,
  ]);
  assert.equal(v[0].v, 2, "la contestation reste possible apres cloture");
});
