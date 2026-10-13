// =============================================================================
// 0066 — Publication d'un document du Studio dans plusieurs cibles (cahier des
// charges, ch. 14). Cibles et effectifs réels, élèves distincts comptés une
// fois, isolation vérifiée côté élève, rejeu sans doublon, succès partiel
// détaillé cible par cible.
//
// Jeu de recette : Mme Martin enseigne en Seconde 1 (3 élèves), en Seconde 2
// (2 élèves) et dans un groupe interclasses (Rayan de Seconde 1, Samir de
// Seconde 2). 7 inscriptions, 5 élèves distincts.
// =============================================================================

import { test } from "node:test";
import assert from "node:assert/strict";
import { ACTEURS, OBJETS, baseDeTest, doitEchouer, enTantQue, lirePour } from "./harness.mjs";

const A1 = OBJETS.espaceMathsA1;
const A2 = OBJETS.espaceMathsA2;
const GROUPE = OBJETS.espaceSpecialite;
const B1 = OBJETS.espaceMathsB1;

async function serveur(db, travail) {
  await db.exec("set role service_role;");
  try {
    return await travail();
  } finally {
    await db.exec("reset role;");
  }
}

/** Un document du Studio déjà converti, avec sa révision, prêt à publier. */
async function documentPret(db, proprietaire = ACTEURS.profMartin, organisation = ACTEURS.lyceeA) {
  return enTantQue(db, proprietaire, async () => {
    const version = await db.query(
      "insert into study.content_versions (organization_id, body, version_number, created_by) values ($1, $2::jsonb, 1, $3) returning id",
      [organisation, JSON.stringify({ document: { version: 1, titre: "Suites", format: "pdf", blocs: [{ type: "paragraphe", texte: "u(n+1) = u(n) + r" }] } }), proprietaire],
    );
    const doc = await db.query(
      "insert into study.studio_documents (organization_id, owner_id, title, state, current_revision_id) values ($1, $2, 'Les suites', 'a_verifier', $3) returning id",
      [organisation, proprietaire, version.rows[0].id],
    );
    return { document: doc.rows[0].id, revision: version.rows[0].id };
  });
}

const publier = (db, document, cours, titre = "Les suites") =>
  serveur(db, async () => (await db.query("select * from study.studio_publier_plusieurs($1, $2, $3, $4)", [ACTEURS.profMartin, document, cours, titre])).rows);

test("PUBM-01 — les cibles sont les cours réellement enseignés, avec de vrais effectifs et des élèves comptés une fois", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());
  const { document } = await documentPret(db);

  const cibles = await serveur(db, async () => (await db.query("select * from study.studio_cibles_publication($1, $2)", [ACTEURS.profMartin, document])).rows);
  const parId = new Map(cibles.map((x) => [x.teaching_space_id, x]));
  assert.deepEqual([...parId.keys()].sort(), [A1, A2, GROUPE].sort(), "trois cours, classes et groupe ; rien du lycée B");
  assert.equal(parId.get(A1).effectif, 3);
  assert.equal(parId.get(A2).effectif, 2, "Samir et un élève dont le compte est encore à activer : il fait partie du public");
  assert.equal(parId.get(GROUPE).effectif, 2);
  assert.equal(parId.get(GROUPE).genre, "groupe");
  assert.equal(parId.get(A1).genre, "classe");
  assert.ok(cibles.every((x) => x.deja_publie === false && x.version_a_jour === false));

  const uniques = await serveur(db, async () => (await db.query("select study.studio_destinataires_uniques($1, $2) as n", [ACTEURS.profMartin, [A1, A2, GROUPE]])).rows[0].n);
  assert.equal(uniques, 5, "7 inscriptions, mais 5 élèves distincts");

  const sonde = await serveur(db, async () => (await db.query("select study.studio_destinataires_uniques($1, $2) as n", [ACTEURS.profMartin, [B1]])).rows[0].n);
  assert.equal(sonde, 0, "un cours qu'on n'enseigne pas ne compte personne");

  // Le document d'un collègue n'ouvre pas ses cibles.
  const autre = await doitEchouer(() => serveur(db, () => db.query("select * from study.studio_cibles_publication($1, $2)", [ACTEURS.profAutre, document])));
  assert.match(autre.message, /document introuvable/);
});

test("PUBM-02 — publier dans trois cibles : trois séances, même version, et chaque élève ne voit que les siennes", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());
  const { document, revision } = await documentPret(db);

  const resultats = await publier(db, document, [A1, A2, GROUPE]);
  assert.equal(resultats.length, 3);
  assert.ok(resultats.every((r) => r.resultat === "publiee" && r.seance !== null), JSON.stringify(resultats));

  const seances = await serveur(db, async () => (await db.query("select teaching_space_id, content_version_id, state from study.lessons where origin_studio_document = $1", [document])).rows);
  assert.equal(seances.length, 3);
  assert.deepEqual(seances.map((s) => s.teaching_space_id).sort(), [A1, A2, GROUPE].sort());
  assert.ok(seances.every((s) => s.content_version_id === revision && s.state === "publiee"), "la version figée est celle relue");

  // Isolation, lue sous l'identité de chaque élève (RLS) :
  const voit = async (eleve) => (await lirePour(db, eleve, "select teaching_space_id from study.lessons where origin_studio_document = $1", [document])).map((r) => r.teaching_space_id).sort();
  assert.deepEqual(await voit(ACTEURS.eleveA1Lina), [A1], "Lina : Seconde 1 seulement, pas le groupe");
  assert.deepEqual(await voit(ACTEURS.eleveA1Rayan), [A1, GROUPE].sort(), "Rayan : sa classe et son groupe");
  assert.deepEqual(await voit(ACTEURS.eleveA2Samir), [A2, GROUPE].sort(), "Samir : sa classe et son groupe");
  assert.deepEqual(await voit(ACTEURS.eleveB), [], "l'élève du lycée B : rien");
});

test("PUBM-03 — rejouer la même publication (double clic, délai dépassé) ne crée rien", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());
  const { document } = await documentPret(db);

  await publier(db, document, [A1, GROUPE]);
  const avant = await serveur(db, async () => (await db.query("select count(*)::int n from study.lesson_publications lp join study.lessons l on l.id = lp.lesson_id where l.origin_studio_document = $1", [document])).rows[0].n);
  const dates = await serveur(db, async () => (await db.query("select id, published_at from study.lessons where origin_studio_document = $1 order by id", [document])).rows);

  const rejeu = await publier(db, document, [A1, GROUPE, A1]);
  assert.equal(rejeu.length, 2, "une cible répétée dans la demande ne compte qu'une fois");
  assert.ok(rejeu.every((r) => r.resultat === "deja_publiee" && r.seance !== null));

  const apres = await serveur(db, async () => (await db.query("select count(*)::int n from study.lesson_publications lp join study.lessons l on l.id = lp.lesson_id where l.origin_studio_document = $1", [document])).rows[0].n);
  assert.equal(apres, avant, "aucune publication de plus");
  const datesApres = await serveur(db, async () => (await db.query("select id, published_at from study.lessons where origin_studio_document = $1 order by id", [document])).rows);
  assert.deepEqual(datesApres, dates, "même la date de publication n'a pas bougé");
});

test("PUBM-04 — une affectation retirée entre l'affichage et le clic : seule cette cible est refusée, et c'est dit", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());
  const { document } = await documentPret(db);

  // Quelqu'un retire Mme Martin de la Seconde 2 pendant qu'elle choisit.
  await db.query("update study.teacher_assignments set ends_on = current_date - 1 where teaching_space_id = $1 and profile_id = $2", [A2, ACTEURS.profMartin]);

  const resultats = await publier(db, document, [A1, A2, GROUPE, B1]);
  const parCible = Object.fromEntries(resultats.map((r) => [r.cible, r]));
  assert.equal(parCible[A1].resultat, "publiee");
  assert.equal(parCible[GROUPE].resultat, "publiee");
  assert.equal(parCible[A2].resultat, "refusee");
  assert.equal(parCible[A2].raison, "non_affecte");
  assert.equal(parCible[B1].resultat, "refusee", "un cours d'un autre lycée est refusé, même avec son identifiant");
  assert.equal(parCible[B1].raison, "cours_introuvable");

  const seances = await serveur(db, async () => (await db.query("select teaching_space_id from study.lessons where origin_studio_document = $1", [document])).rows.map((r) => r.teaching_space_id).sort());
  assert.deepEqual(seances, [A1, GROUPE].sort(), "rien n'a été écrit pour les cibles refusées");

  const trace = (await db.query("select metadata from study.audit_events where action = 'publication_multiple' and object_id = $1", [document])).rows[0].metadata;
  assert.deepEqual(trace, { cibles: 4, publiees: 2, refusees: 2, rejouees: 0 });
});

test("PUBM-05 — ce qui porte sur le document fait échouer l'ensemble", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());
  const { document } = await documentPret(db);

  const parAutre = await doitEchouer(() => serveur(db, () => db.query("select * from study.studio_publier_plusieurs($1, $2, $3, 'x')", [ACTEURS.profAutre, document, [A1]])));
  assert.match(parAutre.message, /document introuvable/);
  const vide = await doitEchouer(() => publier(db, document, []));
  assert.match(vide.message, /aucune cible/);
  const sansTitre = await doitEchouer(() => publier(db, document, [A1], "   "));
  assert.match(sansTitre.message, /titre vide/);

  await db.query("update study.studio_documents set state = 'traitement' where id = $1", [document]);
  const pasPret = await doitEchouer(() => publier(db, document, [A1]));
  assert.match(pasPret.message, /pas pret/);
  assert.equal((await db.query("select count(*)::int n from study.lessons where origin_studio_document = $1", [document])).rows[0].n, 0);
});

test("PUBM-06 — une nouvelle révision republiée remplace la version, sans nouvelle séance", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());
  const { document } = await documentPret(db);
  await publier(db, document, [A1]);

  const v2 = await enTantQue(db, ACTEURS.profMartin, async () =>
    (await db.query("insert into study.content_versions (organization_id, body, version_number, created_by) values ($1, '{\"document\":{\"blocs\":[]}}'::jsonb, 2, $2) returning id", [ACTEURS.lyceeA, ACTEURS.profMartin])).rows[0].id,
  );
  await db.query("update study.studio_documents set current_revision_id = $1 where id = $2", [v2, document]);

  const cibles = await serveur(db, async () => (await db.query("select * from study.studio_cibles_publication($1, $2) where teaching_space_id = $3", [ACTEURS.profMartin, document, A1])).rows[0]);
  assert.equal(cibles.deja_publie, true);
  assert.equal(cibles.version_a_jour, false, "la version en ligne n'est plus la dernière");

  const [r] = await publier(db, document, [A1]);
  assert.equal(r.resultat, "mise_a_jour");
  const seances = await serveur(db, async () => (await db.query("select content_version_id from study.lessons where origin_studio_document = $1", [document])).rows);
  assert.equal(seances.length, 1);
  assert.equal(seances[0].content_version_id, v2);
});

test("PUBM-07 — aucune des trois fonctions n'est exécutable depuis une session navigateur", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());
  for (const f of ["study.studio_cibles_publication(uuid, uuid)", "study.studio_destinataires_uniques(uuid, uuid[])", "study.studio_publier_plusieurs(uuid, uuid, uuid[], text)"]) {
    for (const role of ["anon", "authenticated"]) {
      assert.equal((await db.query("select has_function_privilege($1, $2, 'execute') as ok", [role, f])).rows[0].ok, false, `${role} : ${f}`);
    }
    assert.equal((await db.query("select has_function_privilege('service_role', $1, 'execute') as ok", [f])).rows[0].ok, true);
  }
});

test("PUBM-PDF13 — retirer le document d'un cours le laisse dans la bibliothèque et dans les autres cours", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());
  const { document } = await documentPret(db);
  await publier(db, document, [A1, A2]);
  const lecons = (await db.query("select id, teaching_space_id from study.lessons where origin_studio_document = $1", [document])).rows;
  assert.equal(lecons.length, 2);
  const enA1 = lecons.find((l) => l.teaching_space_id === A1).id;
  const enA2 = lecons.find((l) => l.teaching_space_id === A2).id;

  // Le geste du Studio « Dépublier », sous les droits de Mme Martin.
  await enTantQue(db, ACTEURS.profMartin, () => db.query("update study.lessons set state = 'brouillon', published_at = null where id = $1", [enA1]));

  const doc = (await db.query("select archived_at, current_revision_id from study.studio_documents where id = $1", [document])).rows[0];
  assert.equal(doc.archived_at, null, "le document reste dans la bibliothèque");
  assert.ok(doc.current_revision_id, "sa révision demeure");
  assert.equal((await db.query("select state from study.lessons where id = $1", [enA2])).rows[0].state, "publiee", "l'autre cours le garde");
  const samir = await lirePour(db, ACTEURS.eleveA2Samir, "select id from study.lessons where id = $1", [enA2]);
  assert.equal(samir.length, 1, "les élèves de l'autre classe le lisent toujours");
  const rayan = await lirePour(db, ACTEURS.eleveA1Rayan, "select id from study.lessons where id = $1", [enA1]);
  assert.equal(rayan.length, 0, "dans le cours retiré, plus rien");
});
