// =============================================================================
// Study V6 — recherche (migration 0049).
// Recette : SEARCH-01 (lexical, accents), SEARCH-02 (retrait), RLS-01
// (aucune fuite inter-classes ni inter-etablissements), perimetre reduit.
// =============================================================================

import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { ACTEURS, OBJETS, baseDeTest, enTantQue, lirePour } from "./harness.mjs";

async function bloc(db, prof, org, lecon, position, texte) {
  await enTantQue(db, prof, (d) =>
    d.query(
      `insert into study.lesson_blocks (organization_id, lesson_id, kind, position, contenu, created_by)
       values ($1, $2, 'texte', $3, $4, $5)`,
      [org, lecon, position, JSON.stringify({ texte }), prof],
    ),
  );
}

async function preparer(db) {
  await bloc(db, ACTEURS.profMartin, ACTEURS.lyceeA, OBJETS.seanceA1, 0, "On dit que a est un antécédent de b par la fonction f lorsque f(a) = b.");
  await bloc(db, ACTEURS.profMartin, ACTEURS.lyceeA, OBJETS.seanceA1, 1, "La lecture graphique d'une image se fait sur l'axe des ordonnées.");
  await bloc(db, ACTEURS.adminB, ACTEURS.lyceeB, OBJETS.seanceB1, 0, "Secret du lycée B : antécédent et image, cours confidentiel.");
  await db.query("select study.recherche_traiter_file(1000)");
}

const chercher = (db, acteur, q, types = null, classe = null) =>
  lirePour(db, acteur, "select * from study.recherche($1, $2, $3)", [q, types, classe]);

test("SEARCH-01 — mots exacts, accents et pluriels ; titre pondere", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());
  await preparer(db);

  const accentue = await chercher(db, ACTEURS.eleveA1Rayan, "antécédent");
  assert.ok(accentue.length >= 1);
  assert.equal(accentue[0].source_id, OBJETS.seanceA1);
  assert.match(accentue[0].extrait, /antécédent/, "passage rendu avec ses accents");

  const sansAccent = await chercher(db, ACTEURS.eleveA1Rayan, "antecedents");
  assert.ok(sansAccent.some((r) => r.source_id === OBJETS.seanceA1), "accents et pluriel tolerés");

  const parTitre = await chercher(db, ACTEURS.eleveA1Rayan, "resoudre probleme");
  assert.ok(parTitre.some((r) => r.passage_ref === "entete"), "le titre de seance est cherchable");

  assert.deepEqual(await chercher(db, ACTEURS.eleveA1Rayan, " "), [], "une requete vide n'extrait rien");
});

test("RLS-01 — aucun resultat, titre ou extrait d'une autre classe ou d'un autre lycee", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());
  await preparer(db);

  for (const [qui, attendu] of [
    [ACTEURS.eleveA2Samir, []],
    [ACTEURS.eleveB, [OBJETS.seanceB1]],
    [ACTEURS.profAutre, []],
    [ACTEURS.profMartin, [OBJETS.seanceA1]],
  ]) {
    const r = await chercher(db, qui, "antécédent");
    assert.deepEqual([...new Set(r.map((x) => x.source_id))], attendu, `perimetre de ${qui}`);
  }

  // L'index lui-meme ne se lit pas hors droits.
  const brut = await lirePour(db, ACTEURS.eleveA2Samir, "select titre from study.recherche_documents");
  assert.equal(brut.length, 0);
  // Le vocabulaire de correction ne vient que du visible.
  const vocabulaire = await lirePour(db, ACTEURS.eleveB, "select mot from study.recherche_vocabulaire()");
  assert.ok(!vocabulaire.some((v) => v.mot === "resoudre"), "pas de mot d'une autre ecole");

  // Le perimetre client reduit, il n'etend pas.
  const etendu = await chercher(db, ACTEURS.eleveA1Rayan, "antécédent", null, OBJETS.classeA2);
  assert.equal(etendu.length, 0);
});

test("SEARCH-02 — une seance depubliee disparait avant toute reindexation", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());
  await preparer(db);
  assert.ok((await chercher(db, ACTEURS.eleveA1Rayan, "antécédent")).length > 0);

  await enTantQue(db, ACTEURS.profMartin, (d) =>
    d.query("update study.lessons set state = 'archivee', archived_at = now() where id = $1", [OBJETS.seanceA1]),
  );
  // Pas de traitement de file ici : le retrait ne l'attend pas.
  assert.deepEqual(await chercher(db, ACTEURS.eleveA1Rayan, "antécédent"), []);
  const restes = await db.query("select count(*)::int as n from study.recherche_documents where source_id = $1", [OBJETS.seanceA1]);
  assert.equal(restes.rows[0].n, 0, "plus aucun passage en index");
});

test("Messages et fiches : visibles de qui doit, retires des que masques", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());
  await preparer(db);

  const salon = (await db.query("select id from study.salons where class_id = $1 and kind = 'general'", [OBJETS.classeA1])).rows[0].id;
  const message = (
    await lirePour(db, ACTEURS.eleveA1Lina, "select * from study.salon_envoyer($1, 'Comment trouver un antécédent graphiquement ?', $2)", [
      salon,
      randomUUID(),
    ])
  )[0];
  await db.query("select study.recherche_traiter_file(1000)");

  const parRayan = await chercher(db, ACTEURS.eleveA1Rayan, "antécédent", ["message"]);
  assert.deepEqual(parRayan.map((r) => r.source_id), [message.id]);
  assert.equal(parRayan[0].validation, "eleve");
  assert.deepEqual(await chercher(db, ACTEURS.eleveA2Samir, "antécédent", ["message"]), []);

  await lirePour(db, ACTEURS.profMartin, "select study.salon_masquer($1, true, 'hors sujet')", [message.id]);
  assert.deepEqual(await chercher(db, ACTEURS.eleveA1Rayan, "antécédent", ["message"]), []);

  // Fiche : proprietaire seulement.
  await db.query(
    `insert into study.fiches_revision (organization_id, owner_id, titre, format, sources, empreinte, cle_idempotence, etat, sections)
     values ($1, $2, 'Ma fiche antécédents', 'essentiel', '[{"lesson_id": "${OBJETS.seanceA1}"}]', 'x', gen_random_uuid(), 'ready',
             '[{"titre": "Les notions", "extraits": [{"texte": "antécédent de b"}]}]')`,
    [ACTEURS.lyceeA, ACTEURS.eleveA1Rayan],
  );
  await db.query("select study.recherche_traiter_file(1000)");
  assert.equal((await chercher(db, ACTEURS.eleveA1Rayan, "antécédent", ["fiche"])).length, 1);
  assert.equal((await chercher(db, ACTEURS.eleveA1Lina, "antécédent", ["fiche"])).length, 0);
  assert.equal((await chercher(db, ACTEURS.profMartin, "antécédent", ["fiche"])).length, 0);
});

test("Un retrait d'eleve coupe aussi ses resultats", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());
  await preparer(db);
  assert.ok((await chercher(db, ACTEURS.eleveA1Lina, "antécédent")).length > 0);
  await enTantQue(
    db,
    ACTEURS.adminA,
    (d) => d.query("select study.classe_retirer_eleve($1, $2, 'depart')", [OBJETS.classeA1, ACTEURS.eleveA1Lina]),
    { mfa: true },
  );
  assert.deepEqual(await chercher(db, ACTEURS.eleveA1Lina, "antécédent"), []);
});

test("L'indexation est asynchrone et chaque ecriture planifie un travail", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());
  await bloc(db, ACTEURS.profMartin, ACTEURS.lyceeA, OBJETS.seanceA1, 0, "Parabole et sommet.");
  assert.deepEqual(await chercher(db, ACTEURS.eleveA1Rayan, "parabole"), [], "rien tant que la file n'est pas traitee");
  const jobs = await db.query("select count(*)::int as n from study_prive.jobs where kind = 'recherche_indexer'");
  assert.ok(jobs.rows[0].n >= 1);
  await db.query("select study.recherche_traiter_file(1000)");
  assert.equal((await chercher(db, ACTEURS.eleveA1Rayan, "parabole")).length, 1);
});
