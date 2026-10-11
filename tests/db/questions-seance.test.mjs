// =============================================================================
// Questions de la classe sur une séance (src/lib/v6/questions-seance.ts).
//
// Rejoue en SQL, sous le rôle de chaque personne, les lectures de
// `questionsDeLaSeance` et de `pointsBloquants` : questions d'un salon citant
// une séance, réponses, compteurs, noms affichables (drapeau adulte).
// Prouve : un camarade de la classe les lit avec la réponse du professeur ;
// un élève d'une autre classe n'en lit rien ; le professeur les retrouve
// regroupées par séance.
// =============================================================================

import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { ACTEURS, OBJETS, baseDeTest, lirePour } from "./harness.mjs";

const envoyer = async (db, acteur, salon, corps, options = {}) =>
  (
    await lirePour(db, acteur, "select * from study.salon_envoyer($1, $2, $3, $4, $5, $6, null, false)", [
      salon,
      corps,
      randomUUID(),
      options.parent ?? null,
      options.kind ?? "message",
      options.lecon ?? null,
    ])
  )[0];

const QUESTIONS = `
  select m.id, m.author_id, m.body, s.label, s.class_id
    from study.messages_salon m
    join study.salons s on s.id = m.salon_id
   where m.kind = 'question' and m.lesson_id = $1 and m.parent_id is null
     and m.deleted_at is null and m.hidden_at is null
   order by m.created_at desc limit 30`;

test("QSEANCE-01 — la classe lit les questions d'une séance et la réponse du professeur ; une autre classe rien", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());
  const maths = (await db.query("select id from study.salons where teaching_space_id = $1", [OBJETS.espaceMathsA1])).rows[0].id;
  await lirePour(db, ACTEURS.profMartin, "select study.salon_changer_mode($1, 'questions')", [maths]);

  const q = await envoyer(db, ACTEURS.eleveA1Rayan, maths, "Comment lire f(3) sur le graphique ?", { lecon: OBJETS.seanceA1 });
  await envoyer(db, ACTEURS.profMartin, maths, "On part de 3 sur l'axe horizontal.", { parent: q.id });

  // Un camarade de la même classe : la question, la réponse, et l'auteur de la réponse est un adulte.
  const lues = await lirePour(db, ACTEURS.eleveA1Lina, QUESTIONS, [OBJETS.seanceA1]);
  assert.equal(lues.length, 1);
  assert.equal(lues[0].body, "Comment lire f(3) sur le graphique ?");
  const reponses = await lirePour(
    db,
    ACTEURS.eleveA1Lina,
    "select author_id, body from study.messages_salon where parent_id = $1 and deleted_at is null and hidden_at is null order by created_at",
    [q.id],
  );
  assert.equal(reponses.length, 1);
  const noms = await lirePour(db, ACTEURS.eleveA1Lina, "select id, adulte from study.noms_affichables($1)", [[reponses[0].author_id, lues[0].author_id]]);
  assert.equal(noms.find((n) => n.id === ACTEURS.profMartin)?.adulte, true, "la réponse est reconnue comme celle d'un adulte");
  assert.equal(noms.find((n) => n.id === ACTEURS.eleveA1Rayan)?.adulte, false);

  // Compteurs : « même question » posé par Lina, relu par elle.
  await lirePour(db, ACTEURS.eleveA1Lina, "select study.salon_meme_question($1, true)", [q.id]);
  const c = await lirePour(db, ACTEURS.eleveA1Lina, "select meme_question, moi_aussi, reponses from study.salon_compteurs($1)", [[q.id]]);
  assert.equal(c[0].meme_question, 1);
  assert.equal(c[0].moi_aussi, true);
  assert.equal(c[0].reponses, 1);

  // Un élève d'une autre classe, et un élève d'un autre lycée : rien.
  assert.equal((await lirePour(db, ACTEURS.eleveA2Samir, QUESTIONS, [OBJETS.seanceA1])).length, 0, "autre classe");
  assert.equal((await lirePour(db, ACTEURS.eleveB, QUESTIONS, [OBJETS.seanceA1])).length, 0, "autre lycée");
});

test("QSEANCE-02 — le professeur retrouve les questions regroupées par séance, avec le titre de la séance", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());
  const maths = (await db.query("select id from study.salons where teaching_space_id = $1", [OBJETS.espaceMathsA1])).rows[0].id;
  await lirePour(db, ACTEURS.profMartin, "select study.salon_changer_mode($1, 'questions')", [maths]);
  await envoyer(db, ACTEURS.eleveA1Rayan, maths, "Pourquoi f(3) = 7 ?", { lecon: OBJETS.seanceA1 });

  const groupes = await lirePour(
    db,
    ACTEURS.profMartin,
    `select m.lesson_id, l.title, count(*)::int as n
       from study.messages_salon m
       left join study.lessons l on l.id = m.lesson_id
      where m.kind = 'question' and m.lesson_id is not null and m.parent_id is null
        and m.deleted_at is null and m.hidden_at is null
        and m.created_at >= now() - interval '30 days'
      group by m.lesson_id, l.title`,
  );
  assert.equal(groupes.length, 1);
  assert.equal(groupes[0].lesson_id, OBJETS.seanceA1);
  assert.ok(groupes[0].title, "le titre de la séance est lisible par le professeur");
  assert.equal(groupes[0].n, 1);

  // Un professeur qui n'enseigne pas dans ce salon n'en voit rien.
  const autre = await lirePour(db, ACTEURS.profAutre, "select id from study.messages_salon where lesson_id = $1", [OBJETS.seanceA1]);
  assert.equal(autre.length, 0);
});
