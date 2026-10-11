// =============================================================================
// 0063 — Évaluations. Le professeur compose et distribue ; l'élève compose
// dans sa fenêtre, sans jamais lire l'attendu ; la correction automatique et
// la saisie papier ; la publication des résultats et la révision.
// =============================================================================

import { test } from "node:test";
import assert from "node:assert/strict";
import { ACTEURS, OBJETS, baseDeTest, doitEchouer, lirePour } from "./harness.mjs";

const ORG = ACTEURS.lyceeA;

/** Une évaluation de trois questions (QCM, numérique, rédigée) sur une notion, en brouillon. */
async function preparer(db, { support = "en_ligne", duree = null } = {}) {
  const [{ id: notion }] = (
    await db.query(
      "insert into study.notions (organization_id, teaching_space_id, label, created_by) values ($1, $2, 'Images et antécédents', $3) returning id",
      [ORG, OBJETS.espaceMathsA1, ACTEURS.profMartin],
    )
  ).rows;
  const [{ id: evaluation }] = await lirePour(
    db,
    ACTEURS.profMartin,
    `insert into study.evaluations (organization_id, teaching_space_id, titre, support, duree_minutes, created_by)
     values ($1, $2, 'Contrôle fonctions', $3, $4, $5) returning id`,
    [ORG, OBJETS.espaceMathsA1, support, duree, ACTEURS.profMartin],
  );
  const q = async (ordre, kind, enonce, choix, points, bonne) => {
    const [{ id }] = await lirePour(
      db,
      ACTEURS.profMartin,
      `insert into study.evaluation_questions (organization_id, evaluation_id, ordre, kind, enonce, choix, points, notion_id)
       values ($1, $2, $3, $4, $5, $6, $7, $8) returning id`,
      [ORG, evaluation, ordre, kind, enonce, choix === null ? null : JSON.stringify(choix), points, notion],
    );
    await lirePour(db, ACTEURS.profMartin, "insert into study.evaluation_corriges (question_id, organization_id, bonne_reponse, explication) values ($1, $2, $3, 'On lit sur l''axe vertical.')", [id, ORG, JSON.stringify(bonne)]);
    return id;
  };
  const qcm = await q(1, "qcm", "Image de 2 par f ?", ["1", "3", "-1"], 2, { index: 1 });
  const num = await q(2, "numerique", "Calcule f(3).", null, 2, { valeur: 7, tolerance: 0 });
  const red = await q(3, "redigee", "Explique la méthode.", null, 4, {});
  return { notion, evaluation, qcm, num, red };
}

/** Le tirage tel que le serveur applicatif l'envoie : ici les choix sont inversés pour Rayan. */
function copie(profil, ids) {
  return {
    profile_id: profil,
    sujet: [
      { question_id: ids.qcm, ordre: 1, kind: "qcm", enonce: "Image de 2 par f ?", choix: ["-1", "3", "1"], points: 2 },
      { question_id: ids.num, ordre: 2, kind: "numerique", enonce: "Calcule f(3).", choix: null, points: 2 },
      { question_id: ids.red, ordre: 3, kind: "redigee", enonce: "Explique la méthode.", choix: null, points: 4 },
    ],
    attendus: [
      { question_id: ids.qcm, attendu: { index: 1 }, permutation: [2, 1, 0] },
      { question_id: ids.num, attendu: { valeur: 7, tolerance: 0 }, permutation: null },
      { question_id: ids.red, attendu: {}, permutation: null },
    ],
  };
}

const distribuer = (db, ids, profils) =>
  lirePour(db, ACTEURS.profMartin, "select study.evaluation_distribuer($1, $2) as n", [ids.evaluation, JSON.stringify(profils.map((p) => copie(p, ids)))]);

test("EVAL-01 — distribuer : chaque élève a sa copie ; corrigés et attendus restent au professeur", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());
  const ids = await preparer(db);

  const eleves = await lirePour(db, ACTEURS.profMartin, "select profile_id from study.eleves_de_l_espace($1)", [OBJETS.espaceMathsA1]);
  assert.ok(eleves.some((e) => e.profile_id === ACTEURS.eleveA1Rayan) && eleves.some((e) => e.profile_id === ACTEURS.eleveA1Lina));
  assert.ok(!eleves.some((e) => e.profile_id === ACTEURS.eleveA2Samir), "un élève d'une autre classe n'est pas dans la liste");
  await doitEchouer(() => lirePour(db, ACTEURS.profAutre, "select * from study.eleves_de_l_espace($1)", [OBJETS.espaceMathsA1]));

  // Avant distribution, l'élève ne voit rien.
  assert.equal((await lirePour(db, ACTEURS.eleveA1Rayan, "select id from study.evaluations")).length, 0);

  const [{ n }] = await distribuer(db, ids, [ACTEURS.eleveA1Rayan, ACTEURS.eleveA1Lina]);
  assert.equal(n, 2);
  const [{ n: encore }] = await distribuer(db, ids, [ACTEURS.eleveA1Rayan]);
  assert.equal(encore, 0, "redistribuer ne crée pas de seconde copie");

  const horsClasse = await doitEchouer(() => distribuer(db, ids, [ACTEURS.eleveA2Samir]));
  assert.match(horsClasse.message, /ELEVE_HORS_ENSEIGNEMENT/);

  assert.equal((await lirePour(db, ACTEURS.eleveA1Rayan, "select id from study.evaluations")).length, 1);
  assert.equal((await lirePour(db, ACTEURS.eleveA1Rayan, "select id from study.evaluation_copies")).length, 1, "sa copie, pas celle de Lina");
  for (const table of ["evaluation_questions", "evaluation_corriges", "evaluation_attendus", "evaluation_amenagements"]) {
    assert.equal((await lirePour(db, ACTEURS.eleveA1Rayan, `select * from study.${table}`)).length, 0, `l'élève ne lit pas ${table}`);
  }
  assert.equal((await lirePour(db, ACTEURS.eleveA2Samir, "select id from study.evaluations")).length, 0, "autre classe : rien");
  assert.equal((await lirePour(db, ACTEURS.eleveB, "select id from study.evaluation_copies")).length, 0, "autre lycée : rien");

  const direct = await doitEchouer(() =>
    lirePour(db, ACTEURS.eleveA1Rayan, "insert into study.evaluation_copies (organization_id, evaluation_id, profile_id, sujet) values ($1, $2, $3, '[]')", [ORG, ids.evaluation, ACTEURS.eleveA1Rayan]),
  );
  assert.ok(direct, "aucune écriture directe de copie");

  const fige = await doitEchouer(() => lirePour(db, ACTEURS.profMartin, "update study.evaluation_questions set points = 5 where id = $1", [ids.qcm]));
  assert.match(fige.message, /SUJET_FIGE/, "le sujet distribué est figé");
});

test("EVAL-02 — passation en ligne : limite avec tiers-temps, correction auto, résultats publiés, révision", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());
  const ids = await preparer(db, { duree: 30 });
  await lirePour(db, ACTEURS.profMartin, "insert into study.evaluation_amenagements (evaluation_id, profile_id, organization_id, coefficient) values ($1, $2, $3, 1.5)", [ids.evaluation, ACTEURS.eleveA1Rayan, ORG]);
  await distribuer(db, ids, [ACTEURS.eleveA1Rayan, ACTEURS.eleveA1Lina]);

  const [ouverte] = await lirePour(db, ACTEURS.eleveA1Rayan, "select copie_id, limite_le, sujet from study.evaluation_commencer($1)", [ids.evaluation]);
  const minutes = (new Date(ouverte.limite_le) - Date.now()) / 60000;
  assert.ok(minutes > 44 && minutes <= 45, `tiers-temps : 30 min × 1,5 (obtenu ${minutes.toFixed(1)})`);
  assert.equal(JSON.stringify(ouverte.sujet).includes("index"), false, "le sujet reçu ne contient pas l'attendu");

  const repondre = (question, reponse) => lirePour(db, ACTEURS.eleveA1Rayan, "select study.evaluation_repondre($1, $2, $3)", [ouverte.copie_id, question, JSON.stringify(reponse)]);
  await repondre(ids.qcm, { index: 1 }); // « 3 » à sa place affichée : juste
  await repondre(ids.num, { valeur: "6" }); // faux
  await repondre(ids.red, { texte: "On part de 2 sur l'axe horizontal." });
  await doitEchouer(() => lirePour(db, ACTEURS.eleveA1Lina, "select study.evaluation_repondre($1, $2, $3)", [ouverte.copie_id, ids.qcm, '{"index":0}']));

  await lirePour(db, ACTEURS.eleveA1Rayan, "select study.evaluation_rendre($1)", [ouverte.copie_id]);
  const apres = await doitEchouer(() => repondre(ids.num, { valeur: "7" }));
  assert.match(apres.message, /COPIE_RENDUE/);
  assert.equal((await lirePour(db, ACTEURS.eleveA1Rayan, "select * from study.evaluation_corrections")).length, 0, "pas de points avant publication");

  const auto = await lirePour(db, ACTEURS.profMartin, "select question_id, points, juste from study.evaluation_corrections where copie_id = $1", [ouverte.copie_id]);
  assert.equal(auto.length, 2, "QCM et numérique corrigés, la rédigée attend le professeur");
  assert.equal(Number(auto.find((a) => a.question_id === ids.qcm).points), 2);
  assert.equal(Number(auto.find((a) => a.question_id === ids.num).points), 0);

  const hors = await doitEchouer(() => lirePour(db, ACTEURS.profMartin, "select study.evaluation_noter($1, $2, 5, null)", [ouverte.copie_id, ids.red]));
  assert.match(hors.message, /POINTS_HORS_BAREME/);
  await lirePour(db, ACTEURS.profMartin, "select study.evaluation_noter($1, $2, 1, 'Méthode incomplète')", [ouverte.copie_id, ids.red]);
  await doitEchouer(() => lirePour(db, ACTEURS.profAutre, "select study.evaluation_noter($1, $2, 4, null)", [ouverte.copie_id, ids.red]));

  await lirePour(db, ACTEURS.profMartin, "select study.evaluation_publier_resultats($1)", [ids.evaluation]);
  const copieCorrigee = await lirePour(db, ACTEURS.eleveA1Rayan, "select question_id, points, attendu, explication, commentaire from study.evaluation_ma_copie($1)", [ids.evaluation]);
  assert.equal(copieCorrigee.length, 3);
  assert.equal(copieCorrigee.reduce((s, l) => s + Number(l.points ?? 0), 0), 3, "2 + 0 + 1 sur 8");
  assert.equal(copieCorrigee.find((l) => l.question_id === ids.red).commentaire, "Méthode incomplète");
  // Lina n'a pas composé : elle voit son sujet, sans réponse ni point — et rien de Rayan.
  const copieLina = await lirePour(db, ACTEURS.eleveA1Lina, "select reponse, points from study.evaluation_ma_copie($1)", [ids.evaluation]);
  assert.equal(copieLina.length, 3);
  assert.ok(copieLina.every((l) => l.reponse === null && l.points === null));
  await doitEchouer(() => lirePour(db, ACTEURS.eleveA2Samir, "select * from study.evaluation_ma_copie($1)", [ids.evaluation]));

  // 3 points sur 8 dans la notion : elle repasse « à revoir ».
  const [etat] = await lirePour(db, ACTEURS.eleveA1Rayan, "select statut from study.etats_revision where notion_id = $1", [ids.notion]);
  assert.equal(etat.statut, "a_revoir");
});

test("EVAL-03 — papier : le professeur saisit et note ; l'élève ne compose pas en ligne", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());
  const ids = await preparer(db, { support: "papier" });
  await distribuer(db, ids, [ACTEURS.eleveA1Lina]);
  const [{ id: copieLina }] = await lirePour(db, ACTEURS.profMartin, "select id from study.evaluation_copies where profile_id = $1", [ACTEURS.eleveA1Lina]);

  const enLigne = await doitEchouer(() => lirePour(db, ACTEURS.eleveA1Lina, "select * from study.evaluation_commencer($1)", [ids.evaluation]));
  assert.match(enLigne.message, /EVALUATION_SUR_PAPIER/);

  await lirePour(db, ACTEURS.profMartin, "select study.evaluation_saisir_reponse($1, $2, $3)", [copieLina, ids.qcm, '{"index":1}']);
  await lirePour(db, ACTEURS.profMartin, "select study.evaluation_saisir_reponse($1, $2, $3)", [copieLina, ids.num, '{"valeur":"7"}']);
  await lirePour(db, ACTEURS.profMartin, "select study.evaluation_noter($1, $2, 4, null)", [copieLina, ids.red]);
  const total = await lirePour(db, ACTEURS.profMartin, "select sum(points)::numeric as t from study.evaluation_corrections where copie_id = $1", [copieLina]);
  assert.equal(Number(total[0].t), 8, "copie papier complète : 8 sur 8");

  const eleveSaisit = await doitEchouer(() => lirePour(db, ACTEURS.eleveA1Lina, "select study.evaluation_saisir_reponse($1, $2, $3)", [copieLina, ids.qcm, '{"index":0}']));
  assert.match(eleveSaisit.message, /NON_ACCESSIBLE/);
});

test("EVAL-04 — correction automatique : QCM multiple, réponse courte, valeur avec virgule", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());
  const ratio = async (kind, reponse, attendu) =>
    Number((await db.query("select study.evaluation_ratio($1, $2, $3) as r", [kind, JSON.stringify(reponse), JSON.stringify(attendu)])).rows[0].r);
  assert.equal(await ratio("qcm_multiple", { indices: [0, 2] }, { indices: [0, 2] }), 1);
  assert.equal(await ratio("qcm_multiple", { indices: [0] }, { indices: [0, 2] }), 0.5);
  assert.equal(await ratio("qcm_multiple", { indices: [0, 1] }, { indices: [0, 2] }), 0, "une bonne, une mauvaise : 0");
  assert.equal(await ratio("courte", { texte: "  Antécédent. " }, { acceptees: ["antecedent"] }), 1, "casse, accents, espaces, point final");
  assert.equal(await ratio("courte", { texte: "image" }, { acceptees: ["antecedent"] }), 0);
  assert.equal(await ratio("numerique", { valeur: "3,5" }, { valeur: 3.5, tolerance: 0 }), 1, "virgule acceptée");
  assert.equal(await ratio("numerique", { valeur: "3.6" }, { valeur: 3.5, tolerance: 0.1 }), 1, "tolérance");
  assert.equal(await ratio("vrai_faux", { vrai: false }, { vrai: true }), 0);
});
