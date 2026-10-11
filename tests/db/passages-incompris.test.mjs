// =============================================================================
// 0062 — « Je n'ai pas compris ce passage ».
// Privé pour l'élève, nombres sans noms pour le professeur de l'enseignement,
// rien pour les autres. Écritures uniquement par les fonctions.
// =============================================================================

import { test } from "node:test";
import assert from "node:assert/strict";
import { ACTEURS, OBJETS, baseDeTest, doitEchouer, lirePour } from "./harness.mjs";

const marquer = (db, qui, lecon, extrait) => lirePour(db, qui, "select study.passage_incompris_marquer($1, $2) as id", [lecon, extrait]);

test("INCOMPRIS-01 — l'élève signale, retrouve et retire ses passages ; personne d'autre ne les lit", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());

  const [{ id }] = await marquer(db, ACTEURS.eleveA1Rayan, OBJETS.seanceA1, "Une fonction affine   s'écrit f(x) = ax + b.");
  const [{ id: encore }] = await marquer(db, ACTEURS.eleveA1Rayan, OBJETS.seanceA1, "une fonction affine s'écrit f(x) = ax + b.");
  assert.equal(encore, id, "le même passage (casse, espaces) n'est compté qu'une fois");

  const miens = await lirePour(db, ACTEURS.eleveA1Rayan, "select id, extrait, compris_le from study.passages_incompris");
  assert.equal(miens.length, 1);
  assert.equal(miens[0].compris_le, null);

  assert.equal((await lirePour(db, ACTEURS.eleveA1Lina, "select id from study.passages_incompris")).length, 0, "un camarade ne lit rien");
  assert.equal((await lirePour(db, ACTEURS.profMartin, "select id from study.passages_incompris")).length, 0, "le professeur ne lit pas les lignes nominatives");

  await lirePour(db, ACTEURS.eleveA1Rayan, "select study.passage_incompris_compris($1)", [id]);
  const apres = await lirePour(db, ACTEURS.eleveA1Rayan, "select compris_le from study.passages_incompris where id = $1", [id]);
  assert.notEqual(apres[0].compris_le, null);

  const autre = await doitEchouer(() => lirePour(db, ACTEURS.eleveA1Lina, "select study.passage_incompris_compris($1)", [id]));
  assert.match(autre.message, /NON_ACCESSIBLE/, "on ne peut pas marquer compris le passage d'un autre");

  const direct = await doitEchouer(() =>
    lirePour(db, ACTEURS.eleveA1Rayan, "insert into study.passages_incompris (organization_id, lesson_id, profile_id, extrait, empreinte) select organization_id, id, $1, 'abc', 'x' from study.lessons where id = $2", [ACTEURS.eleveA1Rayan, OBJETS.seanceA1]),
  );
  assert.ok(direct, "aucune écriture directe dans la table");
});

test("INCOMPRIS-02 — une séance d'une autre classe ou un brouillon est refusé", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());
  const autreClasse = await doitEchouer(() => marquer(db, ACTEURS.eleveA2Samir, OBJETS.seanceA1, "Une fonction affine s'écrit f(x) = ax + b."));
  assert.match(autreClasse.message, /NON_ACCESSIBLE/);
  const brouillon = await doitEchouer(() => marquer(db, ACTEURS.eleveA1Rayan, OBJETS.seanceA1Brouillon, "Un passage du brouillon."));
  assert.match(brouillon.message, /NON_ACCESSIBLE/);
  const court = await doitEchouer(() => marquer(db, ACTEURS.eleveA1Rayan, OBJETS.seanceA1, "ab"));
  assert.match(court.message, /EXTRAIT_TROP_COURT/);
});

test("INCOMPRIS-03 — le professeur voit des nombres sans noms ; un autre professeur rien", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());
  await marquer(db, ACTEURS.eleveA1Rayan, OBJETS.seanceA1, "Pour x = 3, f(3) = 7.");
  await marquer(db, ACTEURS.eleveA1Lina, OBJETS.seanceA1, "pour x = 3,   f(3) = 7.");
  await marquer(db, ACTEURS.eleveA1Lina, OBJETS.seanceA1, "Le coefficient directeur est a.");

  const parPassage = await lirePour(db, ACTEURS.profMartin, "select extrait, eleves from study.passages_incompris_seance($1)", [OBJETS.seanceA1]);
  assert.equal(parPassage.length, 2);
  assert.equal(parPassage[0].eleves, 2, "deux élèves sur le même passage");
  assert.equal(Object.keys(parPassage[0]).some((k) => /profile|nom|auteur/.test(k)), false, "aucune identité rendue");

  const resume = await lirePour(db, ACTEURS.profMartin, "select lesson_id, passages, eleves from study.passages_incompris_resume()");
  assert.equal(resume.length, 1);
  assert.equal(resume[0].passages, 2);
  assert.equal(resume[0].eleves, 2);

  const autre = await doitEchouer(() => lirePour(db, ACTEURS.profAutre, "select * from study.passages_incompris_seance($1)", [OBJETS.seanceA1]));
  assert.match(autre.message, /NON_ACCESSIBLE/);
  assert.equal((await lirePour(db, ACTEURS.profAutre, "select * from study.passages_incompris_resume()")).length, 0);
  const eleve = await doitEchouer(() => lirePour(db, ACTEURS.eleveA1Rayan, "select * from study.passages_incompris_seance($1)", [OBJETS.seanceA1]));
  assert.match(eleve.message, /NON_ACCESSIBLE/, "un élève ne lit pas l'agrégat");
});
