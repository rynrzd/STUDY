// =============================================================================
// Study V6 — travail personnel et moteur de revision (migration 0047).
// Recette : REV-01, REV-02, REV-03, PROJECT-01 (pour les donnees privees),
// correction jamais exposee avant soumission (§8.2).
// =============================================================================

import { test } from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import { ACTEURS, OBJETS, baseDeTest, doitEchouer, enTantQue, lirePour, lirePourAdmin } from "./harness.mjs";

/** Une notion, deux exercices publies (QCM et numerique) et un brouillon. */
async function preparerBanque(db) {
  return enTantQue(db, ACTEURS.profMartin, async (d) => {
    const notion = (
      await d.query(
        `insert into study.notions (organization_id, teaching_space_id, chapter_id, label, created_by)
         values ($1, $2, null, 'Image d''un nombre', $3) returning id`,
        [ACTEURS.lyceeA, OBJETS.espaceMathsA1, ACTEURS.profMartin],
      )
    ).rows[0].id;

    async function exercice(kind, enonce, choix, bonne, extra = {}) {
      const ex = (
        await d.query(
          `insert into study.exercices (organization_id, teaching_space_id, lesson_id, notion_id, created_by)
           values ($1, $2, $3, $4, $5) returning id`,
          [ACTEURS.lyceeA, OBJETS.espaceMathsA1, OBJETS.seanceA1, notion, ACTEURS.profMartin],
        )
      ).rows[0].id;
      const v = (
        await d.query(
          `insert into study.exercice_versions (organization_id, exercice_id, kind, enonce, choix, created_by)
           values ($1, $2, $3, $4, $5, $6) returning id`,
          [ACTEURS.lyceeA, ex, kind, enonce, choix === null ? null : JSON.stringify(choix), ACTEURS.profMartin],
        )
      ).rows[0].id;
      await d.query(
        `insert into study.exercice_corriges (exercice_version_id, organization_id, bonne_reponse, explication, indice, exemple)
         values ($1, $2, $3, $4, $5, $6)`,
        [v, ACTEURS.lyceeA, JSON.stringify(bonne), "On remplace x par 3 : 2 x 3 + 1 = 7.", extra.indice ?? "Remplace x par 3.", extra.exemple ?? null],
      );
      if (extra.publier !== false) await d.query("select study.exercice_publier($1)", [v]);
      return v;
    }

    const qcm = await exercice("qcm", "Image de 3 par f(x) = 2x + 1 ?", ["5", "7", "9"], { index: 1 });
    const num = await exercice("numerique", "Calcule f(2) pour f(x) = 2x + 1.", null, { valeur: 5, tolerance: 0 });
    const brouillon = await exercice("qcm", "Brouillon", ["a", "b"], { index: 0 }, { publier: false });
    return { notion, qcm, num, brouillon };
  });
}

async function tenter(db, acteur, version, reponse, client = randomUUID()) {
  return (
    await lirePour(db, acteur, "select * from study.revision_tenter($1, $2, $3)", [version, JSON.stringify(reponse), client])
  )[0];
}

test("Le corrige ne part jamais vers l'eleve avant la tentative", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());
  const { qcm, brouillon } = await preparerBanque(db);

  const exercices = await lirePour(db, ACTEURS.eleveA1Rayan, "select * from study.exercices_de_la_seance($1)", [OBJETS.seanceA1]);
  assert.equal(exercices.length, 2, "le brouillon n'est pas propose");
  for (const e of exercices) {
    assert.ok(!("bonne_reponse" in e) && !("explication" in e), "aucun champ de correction");
  }
  const corriges = await lirePour(db, ACTEURS.eleveA1Rayan, "select * from study.exercice_corriges");
  assert.equal(corriges.length, 0);
  const versionsBrouillon = await lirePour(db, ACTEURS.eleveA1Rayan, "select id from study.exercice_versions where id = $1", [brouillon]);
  assert.equal(versionsBrouillon.length, 0);

  const refus = await doitEchouer(() => tenter(db, ACTEURS.eleveA1Rayan, brouillon, { index: 0 }));
  assert.match(refus.message, /NON_ACCESSIBLE/);
  const autreClasse = await doitEchouer(() => tenter(db, ACTEURS.eleveA2Samir, qcm, { index: 1 }));
  assert.match(autreClasse.message, /NON_ACCESSIBLE/);

  // Une version publiee ne se modifie plus.
  const fige = await doitEchouer(() =>
    lirePour(db, ACTEURS.profMartin, "update study.exercice_versions set enonce = 'change' where id = $1", [qcm]),
  );
  assert.match(fige.message, /VERSION_PUBLIEE_FIGEE/);
});

test("REV-03 — une tentative rejouee ne progresse qu'une fois", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());
  const { qcm, notion } = await preparerBanque(db);

  const client = randomUUID();
  const premiere = await tenter(db, ACTEURS.eleveA1Rayan, qcm, { index: 1 }, client);
  assert.equal(premiere.correct, true);
  assert.equal(premiere.rejouee, false);
  assert.match(premiere.explication, /2 x 3 \+ 1 = 7/);

  const seconde = await tenter(db, ACTEURS.eleveA1Rayan, qcm, { index: 1 }, client);
  assert.equal(seconde.rejouee, true);
  assert.equal(seconde.tentative_id, premiere.tentative_id);

  const n = await db.query("select count(*)::int as n from study.tentatives");
  assert.equal(n.rows[0].n, 1);
  const etat = await db.query("select stade from study.etats_revision where notion_id = $1", [notion]);
  assert.equal(etat.rows[0].stade, 1, "un seul pas de progression");

  // La tentative est immuable, meme pour son auteur.
  const modif = await doitEchouer(() => db.query("update study.tentatives set correct = false"));
  assert.match(modif.message, /TENTATIVE_IMMUABLE/);
});

test("Echec : retour a +1 jour, statut a revoir, entree au carnet", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());
  const { qcm, notion } = await preparerBanque(db);

  const r = await tenter(db, ACTEURS.eleveA1Rayan, qcm, { index: 2 });
  assert.equal(r.correct, false);
  assert.equal(r.statut, "a_revoir");
  const etat = await db.query(
    "select stade, prochaine_revision - (now() at time zone 'Europe/Paris')::date as jours from study.etats_revision where notion_id = $1",
    [notion],
  );
  assert.equal(etat.rows[0].stade, 0);
  assert.equal(etat.rows[0].jours, 1);
  const carnet = await lirePour(db, ACTEURS.eleveA1Rayan, "select id, revision from study.carnet_erreurs");
  assert.equal(carnet.length, 1);

  const rev = await lirePour(db, ACTEURS.eleveA1Rayan, "select study.carnet_annoter($1, 'lecture', 'axe confondu', 1) as r", [carnet[0].id]);
  assert.equal(rev[0].r, 2);
  const conflit = await doitEchouer(() =>
    lirePour(db, ACTEURS.eleveA1Rayan, "select study.carnet_annoter($1, 'calcul', null, 1)", [carnet[0].id]),
  );
  assert.match(conflit.message, /VERSION_CONFLICT/);
});

test("REV-02 — reussite apres indice : stade conserve, reprise a +1 jour", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());
  const { qcm, num, notion } = await preparerBanque(db);

  await tenter(db, ACTEURS.eleveA1Rayan, qcm, { index: 1 }); // stade 1
  const indice = await lirePour(db, ACTEURS.eleveA1Rayan, "select study.revision_aide($1, 'indice') as t", [num]);
  assert.equal(indice[0].t, "Remplace x par 3.");
  const avecAide = await tenter(db, ACTEURS.eleveA1Rayan, num, { valeur: "5" });
  assert.equal(avecAide.correct, true);
  const etat = await db.query(
    "select stade, prochaine_revision - (now() at time zone 'Europe/Paris')::date as jours from study.etats_revision where notion_id = $1",
    [notion],
  );
  assert.equal(etat.rows[0].stade, 1, "stade conserve");
  assert.equal(etat.rows[0].jours, 1, "reprise a +1 jour");

  const dispo = await lirePour(db, ACTEURS.eleveA1Rayan, "select * from study.revision_aides_disponibles($1)", [qcm]);
  assert.deepEqual(dispo[0], { indice: true, exemple: false });
});

test("REV-01 — une reussite isolee ne consolide pas ; trois sur deux jours et deux variantes, si", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());
  const { qcm, num, notion } = await preparerBanque(db);

  const une = await tenter(db, ACTEURS.eleveA1Rayan, qcm, { index: 1 });
  assert.notEqual(une.statut, "consolide");
  const deux = await tenter(db, ACTEURS.eleveA1Rayan, num, { valeur: 5 });
  assert.notEqual(deux.statut, "consolide", "deux reussites le meme jour ne suffisent pas");

  // On simule une journee ecoulee : la date est calculee par le serveur, on la recule.
  await db.exec("alter table study.tentatives disable trigger tentatives_immuables");
  await db.query("update study.tentatives set jour = jour - 1");
  await db.exec("alter table study.tentatives enable trigger tentatives_immuables");

  const trois = await tenter(db, ACTEURS.eleveA1Rayan, qcm, { index: 1 });
  assert.equal(trois.statut, "consolide");
  const etat = await db.query("select statut from study.etats_revision where notion_id = $1", [notion]);
  assert.equal(etat.rows[0].statut, "consolide");
});

test("Donnees privees : ni le professeur ni l'administration ne lisent tentatives, carnet, notes", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());
  const { qcm } = await preparerBanque(db);
  await tenter(db, ACTEURS.eleveA1Rayan, qcm, { index: 0 });
  await lirePour(db, ACTEURS.eleveA1Rayan, "select study.note_enregistrer($1, 'ma note privee', 0)", [OBJETS.seanceA1]);
  await lirePour(
    db,
    ACTEURS.eleveA1Rayan,
    "insert into study.reperes_seance (owner_id, lesson_id, kind) values ($1, $2, 'a_revoir')",
    [ACTEURS.eleveA1Rayan, OBJETS.seanceA1],
  );

  for (const [qui, lire] of [
    [ACTEURS.profMartin, lirePour],
    [ACTEURS.adminA, lirePourAdmin],
    [ACTEURS.eleveA1Lina, lirePour],
  ]) {
    for (const table of ["tentatives", "carnet_erreurs", "etats_revision", "personal_notes", "reperes_seance"]) {
      const rows = await lire(db, qui, `select 1 from study.${table}`);
      assert.equal(rows.length, 0, `${table} invisible pour ${qui}`);
    }
  }
  assert.equal((await lirePour(db, ACTEURS.eleveA1Rayan, "select 1 from study.carnet_erreurs")).length, 1);
});

test("Note personnelle : verrou optimiste et une note par seance", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());

  const r1 = await lirePour(db, ACTEURS.eleveA1Rayan, "select study.note_enregistrer($1, 'v1', 0) as r", [OBJETS.seanceA1]);
  assert.equal(r1[0].r, 1);
  const r2 = await lirePour(db, ACTEURS.eleveA1Rayan, "select study.note_enregistrer($1, 'v2', 1) as r", [OBJETS.seanceA1]);
  assert.equal(r2[0].r, 2);
  const conflit = await doitEchouer(() =>
    lirePour(db, ACTEURS.eleveA1Rayan, "select study.note_enregistrer($1, 'onglet perime', 1)", [OBJETS.seanceA1]),
  );
  assert.match(conflit.message, /VERSION_CONFLICT/);
  const corps = await lirePour(db, ACTEURS.eleveA1Rayan, "select body from study.personal_notes");
  assert.deepEqual(corps.map((c) => c.body), ["v2"], "l'onglet perime n'a rien ecrase");
});

test("Agregats professeur : masques sous cinq personnes ; professeur non affecte refuse", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());
  const { qcm } = await preparerBanque(db);
  await tenter(db, ACTEURS.eleveA1Rayan, qcm, { index: 0 });
  await tenter(db, ACTEURS.eleveA1Lina, qcm, { index: 2 });

  const agregats = await lirePour(db, ACTEURS.profMartin, "select * from study.revision_agregats($1)", [OBJETS.espaceMathsA1]);
  assert.equal(agregats.length, 1);
  assert.equal(agregats[0].a_revoir, null);
  assert.equal(agregats[0].masque, true);

  const refus = await doitEchouer(() => lirePour(db, ACTEURS.profAutre, "select * from study.revision_agregats($1)", [OBJETS.espaceMathsA1]));
  assert.match(refus.message, /NON_ACCESSIBLE/);
});

test("Graphe de prerequis sans cycle ; variante proposee", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());
  const { notion, qcm, num } = await preparerBanque(db);
  const autre = (
    await lirePour(
      db,
      ACTEURS.profMartin,
      "insert into study.notions (organization_id, teaching_space_id, label, created_by) values ($1, $2, 'Antecedent', $3) returning id",
      [ACTEURS.lyceeA, OBJETS.espaceMathsA1, ACTEURS.profMartin],
    )
  )[0].id;
  await lirePour(db, ACTEURS.profMartin, "insert into study.notion_prerequis values ($1, $2)", [autre, notion]);
  const cycle = await doitEchouer(() => lirePour(db, ACTEURS.profMartin, "insert into study.notion_prerequis values ($1, $2)", [notion, autre]));
  assert.match(cycle.message, /CYCLE_DE_PREREQUIS/);

  const variante = await lirePour(db, ACTEURS.eleveA1Rayan, "select study.revision_variante($1) as v", [qcm]);
  assert.equal(variante[0].v, num);
});

test("Lectures de revision (0055) : sources disponibles, reprise de session, carnet", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());
  const { qcm, num } = await preparerBanque(db);

  const dispo = await lirePour(db, ACTEURS.eleveA1Rayan, "select * from study.seances_textes_disponibles($1)", [[OBJETS.seanceA1, OBJETS.seanceB1, OBJETS.seanceA1Brouillon]]);
  assert.deepEqual(dispo.map((d) => d.lesson_id), [OBJETS.seanceA1], "ni l'autre lycee ni le brouillon, pas meme leur titre");
  assert.equal(dispo[0].exercices, 2);

  const session = (await lirePour(db, ACTEURS.eleveA1Rayan, "select study.entrainement_ouvrir('Revoir', $1) as id", [[qcm, num]]))[0].id;
  await lirePour(db, ACTEURS.eleveA1Rayan, "select * from study.revision_tenter($1, $2, gen_random_uuid(), $3)", [qcm, JSON.stringify({ index: 0 }), session]);
  const etat = await lirePour(db, ACTEURS.eleveA1Rayan, "select * from study.entrainement_etat($1)", [session]);
  assert.equal(etat.length, 2);
  assert.equal(etat[0].correct, false, "la reprise sait ce qui a deja ete repondu");
  assert.equal(etat[1].tentative_id, null);
  assert.ok(!("bonne_reponse" in etat[0]));
  assert.equal((await lirePour(db, ACTEURS.eleveA1Lina, "select * from study.entrainement_etat($1)", [session])).length, 0, "la session d'un autre est vide");

  const carnet = await lirePour(db, ACTEURS.eleveA1Rayan, "select * from study.carnet_lire()");
  assert.equal(carnet.length, 1);
  assert.match(carnet[0].explication, /2 x 3 \+ 1 = 7/, "l'explication est rendue apres la tentative");
  assert.equal((await lirePour(db, ACTEURS.profMartin, "select * from study.carnet_lire()")).length, 0);
});
