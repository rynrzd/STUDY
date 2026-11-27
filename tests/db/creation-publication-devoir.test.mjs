import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { ACTEURS, OBJETS, baseDeTest, enTantQue, lirePour } from "./harness.mjs";

test("creation de devoir : une cle rejouee ne cree jamais une seconde ligne ; la publication est rejouable", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());
  const cle = randomUUID();

  const inserer = () => enTantQue(db, ACTEURS.profMartin, () => db.query(
    `insert into study.assignments
      (id, organization_id, teaching_space_id, title, created_by)
     values ($1, $2, $3, 'Travail de recette', $4) returning id`,
    [cle, ACTEURS.lyceeA, OBJETS.espaceMathsA1, ACTEURS.profMartin],
  ));

  const premier = await inserer();
  const devoir = premier.rows[0].id;
  assert.equal(devoir, cle);
  await assert.rejects(inserer(), /duplicate key|unique constraint/i);

  const existants = await lirePour(db, ACTEURS.profMartin,
    "select id from study.assignments where id = $1 and created_by = $2",
    [cle, ACTEURS.profMartin],
  );
  assert.deepEqual(existants.map((r) => r.id), [devoir]);

  const publication = () => lirePour(db, ACTEURS.profMartin,
    "select study.devoir_publier_revision($1)", [devoir],
  );
  await publication();
  await publication();

  const etat = await lirePour(db, ACTEURS.profMartin,
    "select state, published_at from study.assignments where id = $1", [devoir],
  );
  assert.equal(etat[0].state, "publiee");
  assert.ok(etat[0].published_at);

  const { rows: doublons } = await db.query(
    `select profile_id, count(*)::int as nombre from study.assignment_recipients
     where assignment_id = $1 group by profile_id having count(*) > 1`, [devoir],
  );
  assert.equal(doublons.length, 0, "le deuxieme clic ne duplique pas les destinataires");
});
