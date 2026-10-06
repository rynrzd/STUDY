// =============================================================================
// Study V7 — passage d'année scolaire (migration 0059, écran D05).
// Recette : droits, aperçu, refus d'une année sans classe, refus tant que des
// élèves actifs n'ont pas de classe dans l'année cible, bascule confirmée
// idempotente, accès réel des élèves après la bascule, historique conservé.
// =============================================================================

import { test } from "node:test";
import assert from "node:assert/strict";
import { ACTEURS, OBJETS, baseDeTest, doitEchouer, lirePour, lirePourAdmin } from "./harness.mjs";

const contextes = async (db, acteur) => (await lirePour(db, acteur, "select classe, libelle from study.mes_contextes()")).map((c) => c.libelle);

test("Passage d'année : une classe dans l'année cible ne suffit pas ; chaque élève est contrôlé", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());

  const refusProf = await doitEchouer(() => lirePour(db, ACTEURS.profMartin, "select study.annee_preparer('2027-2028', '2027-09-01', '2028-07-05')"));
  assert.match(refusProf.message, /NON_ACCESSIBLE/, "un professeur ne prépare pas l'année");

  const [{ annee_preparer: suivante }] = await lirePourAdmin(db, ACTEURS.adminA, "select study.annee_preparer('2027-2028', '2027-09-01', '2028-07-05')");
  const [{ annee_preparer: encore }] = await lirePourAdmin(db, ACTEURS.adminA, "select study.annee_preparer('2027-2028', '2027-09-01', '2028-07-05')");
  assert.equal(encore, suivante, "relancer ne duplique rien");

  const autre = await doitEchouer(() => lirePourAdmin(db, ACTEURS.adminB, "select * from study.annee_apercu($1)", [suivante]));
  assert.match(autre.message, /NON_ACCESSIBLE/, "un autre établissement ne voit pas cette année");

  const vide = await doitEchouer(() => lirePourAdmin(db, ACTEURS.adminA, "select study.annee_basculer($1)", [suivante]));
  assert.match(vide.message, /ANNEE_SANS_CLASSE/, "pas de bascule vers une année sans classe");

  // Une classe existe dans la nouvelle année, mais personne n'y est inscrit.
  const [{ annee_creer_classe: premiere }] = await lirePourAdmin(db, ACTEURS.adminA, "select study.annee_creer_classe($1, 'Première 1')", [suivante]);
  const [{ annee_creer_classe: memeClasse }] = await lirePourAdmin(db, ACTEURS.adminA, "select study.annee_creer_classe($1, 'Première 1')", [suivante]);
  assert.equal(memeClasse, premiere, "créer deux fois la même classe ne la duplique pas");
  const tous = await lirePourAdmin(db, ACTEURS.adminA, "select identifiant from study.annee_eleves_sans_classe($1)", [suivante]);
  assert.ok(tous.length >= 3, "tous les élèves actifs sont signalés");
  const refusSansClasse = await doitEchouer(() => lirePourAdmin(db, ACTEURS.adminA, "select study.annee_basculer($1)", [suivante]));
  assert.match(refusSansClasse.message, /ELEVES_SANS_CLASSE/, "affirmation vérifiée : une classe ne garantit pas l'accès de chaque élève");

  // Reconduction de la classe A1 vers Première 1 ; les élèves de A2 ne sont pas reconduits.
  const [{ annee_preinscrire_classe: ajoutes }] = await lirePourAdmin(db, ACTEURS.adminA, "select study.annee_preinscrire_classe($1, $2)", [OBJETS.classeA1, premiere]);
  assert.ok(ajoutes >= 2);
  const [{ annee_preinscrire_classe: rejoue }] = await lirePourAdmin(db, ACTEURS.adminA, "select study.annee_preinscrire_classe($1, $2)", [OBJETS.classeA1, premiere]);
  assert.equal(rejoue, 0, "reconduire deux fois n'ajoute rien");
  const refusCroise = await doitEchouer(() => lirePourAdmin(db, ACTEURS.adminB, "select study.annee_preinscrire_classe($1, $2)", [OBJETS.classeA1, premiere]));
  assert.match(refusCroise.message, /NON_ACCESSIBLE/);
  const restants = await lirePourAdmin(db, ACTEURS.adminA, "select identifiant, classe_actuelle from study.annee_eleves_sans_classe($1)", [suivante]);
  const ids = restants.map((r) => r.identifiant);
  assert.ok(ids.includes("samir.nguyen") && !ids.includes("lina.bernard") && !ids.includes("rayan.dupont"), "seuls les élèves non reconduits restent signalés");
  assert.ok(restants.find((r) => r.identifiant === "samir.nguyen").classe_actuelle);
  await doitEchouer(() => lirePourAdmin(db, ACTEURS.adminA, "select study.annee_basculer($1)", [suivante]));

  const avantRayan = await contextes(db, ACTEURS.eleveA2Samir);
  const avantLina = await contextes(db, ACTEURS.eleveA1Lina);
  assert.ok(avantRayan.length > 0 && avantLina.length > 0);
  const salonAncien = (await db.query("select id from study.salons where class_id = $1 and kind = 'general'", [OBJETS.classeA1])).rows[0]?.id;

  const inscriptionsAvant = (await db.query("select count(*)::int as n from study.class_enrollments")).rows[0].n;
  const [{ annee_basculer: fait }] = await lirePourAdmin(db, ACTEURS.adminA, "select study.annee_basculer($1, true)", [suivante]);
  assert.equal(fait, true, "bascule seulement après confirmation explicite");
  const [{ annee_basculer: rejeu }] = await lirePourAdmin(db, ACTEURS.adminA, "select study.annee_basculer($1, true)", [suivante]);
  assert.equal(rejeu, false, "relancée, la bascule ne fait rien");

  // Accès effectifs après la bascule.
  assert.deepEqual(await contextes(db, ACTEURS.eleveA1Lina), ["Première 1"], "un élève inscrit retrouve sa nouvelle classe, et elle seule");
  assert.deepEqual(await contextes(db, ACTEURS.eleveA2Samir), [], "l'élève non reconduit n'a plus de classe : l'application l'envoie en accès en attente");
  const principales = (await db.query("select count(*)::int as n from study.class_enrollments where class_id = $1 and is_principal and ends_on is null", [premiere])).rows[0].n;
  assert.equal(principales, ajoutes, "les préinscriptions deviennent principales à la bascule");
  if (salonAncien) {
    const [{ l }] = await lirePour(db, ACTEURS.eleveA1Lina, "select study.salon_lisible($1) as l", [salonAncien]);
    assert.equal(l, false, "le salon de l'ancienne classe n'est plus lisible");
  }

  const annees = (await db.query("select label, is_current, archived_at is not null as archivee from study.academic_years where organization_id = $1 order by label", [ACTEURS.lyceeA])).rows;
  assert.deepEqual(annees.map((a) => [a.label, a.is_current, a.archivee]), [["2026-2027", false, true], ["2027-2028", true, false]]);
  assert.equal((await db.query("select count(*)::int as n from study.class_enrollments")).rows[0].n, inscriptionsAvant, "aucune inscription supprimée");
  assert.equal((await db.query("select count(*)::int as n from study.class_enrollments where class_id = $1 and ends_on is null", [OBJETS.classeA1])).rows[0].n, 0, "inscriptions quittées closes et datées");
  const lyceeB = (await db.query("select is_current from study.academic_years where organization_id = $1", [ACTEURS.lyceeB])).rows;
  assert.deepEqual(lyceeB.map((a) => a.is_current), [true], "l'autre établissement n'est pas touché");
  const [audit] = (await db.query("select metadata from study.audit_events where action = 'annee_basculee'")).rows;
  assert.equal(audit.metadata.sans_classe_confirme, true, "la confirmation est journalisée");
});
