// =============================================================================
// Study V6 — vie de classe (migration 0050).
// Recette : CLASS-01, CLASS-02, CLASS-03, consultations respectant leurs
// destinataires, decisions a transitions verifiees, bibliotheque.
// =============================================================================

import { test } from "node:test";
import assert from "node:assert/strict";
import { ACTEURS, OBJETS, baseDeTest, doitEchouer, lirePour, lirePourAdmin } from "./harness.mjs";

/** Martin professeur principal de A1, Lina deleguee en mandat. */
async function preparer(db) {
  await db.query("update study.classes set professeur_principal = $1 where id = $2", [ACTEURS.profMartin, OBJETS.classeA1]);
  await db.query(
    `insert into study.delegate_terms (organization_id, class_id, profile_id, ends_on, created_by)
     values ($1, $2, $3, current_date + 200, $4)`,
    [ACTEURS.lyceeA, OBJETS.classeA1, ACTEURS.eleveA1Lina, ACTEURS.profMartin],
  );
  const id = (await lirePour(db, ACTEURS.eleveA1Lina, "select study.consultation_creer($1, 'Consultation d''octobre', 7) as id", [OBJETS.classeA1]))[0].id;
  return id;
}

const ouvrir = (db, acteur, id) => lirePour(db, acteur, "select study.consultation_etat($1, 'ouverte', 7)", [id]);
const repondre = (db, acteur, id, version, proposition = "Un calendrier commun des controles") =>
  lirePour(db, acteur, "select study.consultation_repondre($1, 'Les fiches', 'Trop de controles groupes', $2, 'charge', $3) as v", [
    id,
    proposition,
    version,
  ]);

test("Une reponse par eleve, modifiable sous version tant que c'est ouvert", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());
  const id = await preparer(db);

  const avant = await doitEchouer(() => repondre(db, ACTEURS.eleveA1Rayan, id, 0));
  assert.match(avant.message, /CONSULTATION_CLOSE/, "pas de reponse a un brouillon");

  await ouvrir(db, ACTEURS.eleveA1Lina, id);
  assert.equal((await repondre(db, ACTEURS.eleveA1Rayan, id, 0))[0].v, 1);
  const double = await doitEchouer(() => repondre(db, ACTEURS.eleveA1Rayan, id, 0));
  assert.match(double.message, /VERSION_CONFLICT/, "une seule reponse");
  assert.equal((await repondre(db, ACTEURS.eleveA1Rayan, id, 1, "Plutot une semaine sans controle"))[0].v, 2);

  const horsClasse = await doitEchouer(() => repondre(db, ACTEURS.eleveA2Samir, id, 0));
  assert.match(horsClasse.message, /NON_ACCESSIBLE/);
  assert.equal((await lirePour(db, ACTEURS.eleveA2Samir, "select id from study.consultations")).length, 0);
});

test("Destinataires : delegues en mandat et professeur principal, personne d'autre", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());
  const id = await preparer(db);
  await ouvrir(db, ACTEURS.profMartin, id);
  await repondre(db, ACTEURS.eleveA1Rayan, id, 0);

  assert.equal((await lirePour(db, ACTEURS.eleveA1Lina, "select author_id from study.consultation_reponses")).length, 1);
  assert.equal((await lirePour(db, ACTEURS.profMartin, "select author_id from study.consultation_reponses")).length, 1);
  assert.equal((await lirePour(db, ACTEURS.eleveA1Homonyme1, "select 1 from study.consultation_reponses")).length, 0);
  assert.equal((await lirePourAdmin(db, ACTEURS.adminA, "select 1 from study.consultation_reponses")).length, 0, "pas de lecture brute implicite");
  assert.equal((await lirePour(db, ACTEURS.profAutre, "select 1 from study.consultation_reponses")).length, 0);

  // CLASS-02 : mandat expire, plus aucun acces aux contributions.
  await db.query("update study.delegate_terms set starts_on = current_date - 300, ends_on = current_date - 1");
  assert.equal((await lirePour(db, ACTEURS.eleveA1Lina, "select 1 from study.consultation_reponses")).length, 0);
  const mutation = await doitEchouer(() => lirePour(db, ACTEURS.eleveA1Lina, "select study.consultation_etat($1, 'close')", [id]));
  assert.match(mutation.message, /NON_ACCESSIBLE/, "mandat expire : mutation bloquee");
});

test("CLASS-01 / CLASS-03 — cloture, synthese anonyme en brouillon, publication explicite", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());
  const id = await preparer(db);
  await ouvrir(db, ACTEURS.eleveA1Lina, id);
  await repondre(db, ACTEURS.eleveA1Rayan, id, 0);
  await lirePour(db, ACTEURS.eleveA1Lina, "select study.consultation_etat($1, 'close')", [id]);

  const close = await doitEchouer(() => repondre(db, ACTEURS.eleveA1Rayan, id, 1));
  assert.match(close.message, /CONSULTATION_CLOSE/);

  const v = (await lirePour(db, ACTEURS.eleveA1Lina, "select study.consultation_preparer_synthese($1) as v", [id]))[0].v;
  const brouillon = (await lirePour(db, ACTEURS.eleveA1Lina, "select texte, sujets, etat from study.consultation_syntheses"))[0];
  assert.equal(brouillon.etat, "brouillon");
  assert.ok(!/Rayan|Dupont/i.test(brouillon.texte + JSON.stringify(brouillon.sujets)), "aucun nom dans la synthese");
  assert.equal(brouillon.sujets[0].categorie, "charge");

  // La classe ne voit pas le brouillon.
  assert.equal((await lirePour(db, ACTEURS.eleveA1Rayan, "select 1 from study.consultation_syntheses")).length, 0);

  const nonRelue = await doitEchouer(() =>
    lirePour(db, ACTEURS.eleveA1Lina, "select study.consultation_publier_synthese($1, $2)", [id, v]),
  );
  assert.match(nonRelue.message, /SYNTHESE_NON_RELUE/, "rien ne se publie sans relecture");

  const v2 = (
    await lirePour(db, ACTEURS.eleveA1Lina, "select study.consultation_modifier_synthese($1, $2, $3) as v", [
      id,
      "La classe demande un calendrier commun des controles. Nous le transmettons au conseil.",
      v,
    ])
  )[0].v;
  await lirePour(db, ACTEURS.eleveA1Lina, "select study.consultation_publier_synthese($1, $2)", [id, v2]);
  const publiee = await lirePour(db, ACTEURS.eleveA1Rayan, "select texte from study.consultation_syntheses");
  assert.match(publiee[0].texte, /calendrier commun/);
  assert.equal((await lirePour(db, ACTEURS.eleveA2Samir, "select 1 from study.consultation_syntheses")).length, 0);
});

test("Decisions : transitions verifiees, motif et suivi exiges, publiees a la classe seulement", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());
  await preparer(db);

  const id = (
    await lirePour(db, ACTEURS.eleveA1Lina, "select study.decision_creer($1, 'Calendrier commun des controles', 'Propose par la classe') as id", [
      OBJETS.classeA1,
    ])
  )[0].id;
  const saut = await doitEchouer(() =>
    lirePour(db, ACTEURS.eleveA1Lina, "select study.decision_changer($1, 'faite', null, null, null, 1)", [id]),
  );
  assert.match(saut.message, /TRANSITION_INVALIDE/);
  const refusSansMotif = await doitEchouer(() =>
    lirePour(db, ACTEURS.eleveA1Lina, "select study.decision_changer($1, 'refusee', '', null, null, 1)", [id]),
  );
  assert.match(refusSansMotif.message, /MOTIF_REQUIS/);

  let v = (await lirePour(db, ACTEURS.eleveA1Lina, "select study.decision_changer($1, 'transmise', null, null, null, 1) as v", [id]))[0].v;
  v = (await lirePour(db, ACTEURS.profMartin, "select study.decision_changer($1, 'repondue', 'Accord du conseil', null, null, $2) as v", [id, v]))[0].v;
  const sansSuivi = await doitEchouer(() =>
    lirePour(db, ACTEURS.profMartin, "select study.decision_changer($1, 'en_cours', null, 'Mme Laurent', null, $2)", [id, v]),
  );
  assert.match(sansSuivi.message, /SUIVI_REQUIS/);
  v = (
    await lirePour(db, ACTEURS.profMartin, "select study.decision_changer($1, 'en_cours', null, 'Mme Laurent', current_date + 14, $2) as v", [id, v])
  )[0].v;
  const perime = await doitEchouer(() =>
    lirePour(db, ACTEURS.profMartin, "select study.decision_changer($1, 'faite', null, null, null, 1)", [id]),
  );
  assert.match(perime.message, /VERSION_CONFLICT/);

  assert.equal((await lirePour(db, ACTEURS.eleveA1Rayan, "select statut from study.decisions"))[0].statut, "en_cours");
  assert.equal((await lirePour(db, ACTEURS.eleveA2Samir, "select 1 from study.decisions")).length, 0);
  const historique = await lirePour(db, ACTEURS.eleveA1Rayan, "select vers_statut from study.decision_evenements order by id");
  assert.deepEqual(historique.map((h) => h.vers_statut), ["proposee", "transmise", "repondue", "en_cours"]);
  const parEleve = await doitEchouer(() =>
    lirePour(db, ACTEURS.eleveA1Rayan, "select study.decision_changer($1, 'faite', null, null, null, $2)", [id, v]),
  );
  assert.match(parEleve.message, /NON_ACCESSIBLE/, "un eleve non delegue ne decide pas");

  // Cherchable par la classe, pas ailleurs.
  await db.query("select study.recherche_traiter_file(1000)");
  const trouvee = await lirePour(db, ACTEURS.eleveA1Rayan, "select source_id from study.recherche('calendrier controles', array['decision'])");
  assert.deepEqual(trouvee.map((r) => r.source_id), [id]);
  assert.equal((await lirePour(db, ACTEURS.eleveA2Samir, "select 1 from study.recherche('calendrier controles')")).length, 0);
});

test("Bibliotheque : proposee par un eleve, validee par un enseignant, retiree sans trace pour la classe", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());

  const id = (
    await lirePour(db, ACTEURS.eleveA1Rayan, "select study.bibliotheque_proposer($1, 'Lire une image', 'On lit sur l''axe vertical.', 'explication') as id", [
      OBJETS.classeA1,
    ])
  )[0].id;
  let r = (await lirePour(db, ACTEURS.eleveA1Lina, "select statut, validee_par from study.bibliotheque"))[0];
  assert.equal(r.statut, "proposee");
  assert.equal(r.validee_par, null, "aucune validation fabriquee");

  const auto = await doitEchouer(() => lirePour(db, ACTEURS.eleveA1Rayan, "select study.bibliotheque_statut($1, 'validee', 1)", [id]));
  assert.match(auto.message, /NON_ACCESSIBLE/);
  await lirePour(db, ACTEURS.profMartin, "select study.bibliotheque_statut($1, 'validee', 1)", [id]);
  r = (await lirePour(db, ACTEURS.eleveA1Lina, "select statut from study.bibliotheque"))[0];
  assert.equal(r.statut, "validee");

  await lirePour(db, ACTEURS.profMartin, "select study.bibliotheque_statut($1, 'retiree', 2)", [id]);
  assert.equal((await lirePour(db, ACTEURS.eleveA1Lina, "select 1 from study.bibliotheque")).length, 0);
  assert.equal((await lirePour(db, ACTEURS.eleveA2Samir, "select 1 from study.bibliotheque")).length, 0);

  const intrus = await doitEchouer(() =>
    lirePour(db, ACTEURS.eleveA2Samir, "select study.bibliotheque_proposer($1, 'x x x', 'y y y', 'explication')", [OBJETS.classeA1]),
  );
  assert.match(intrus.message, /NON_ACCESSIBLE/);
});
