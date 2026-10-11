// =============================================================================
// 0062 — Revue « attaquant ». On se met dans la peau d'un élève malveillant et
// d'un professeur d'un autre établissement : chaque scénario vérifie qu'une
// règle de la base (RLS ou fonction security definer) bloque, et non une
// vérification d'interface. Complète passages-incompris.test.mjs (chemins
// normaux) par les abus.
// =============================================================================

import { test } from "node:test";
import assert from "node:assert/strict";
import { ACTEURS, OBJETS, baseDeTest, doitEchouer, lirePour } from "./harness.mjs";

const marquer = (db, qui, lecon, extrait) => lirePour(db, qui, "select study.passage_incompris_marquer($1, $2) as id", [lecon, extrait]);
const UUID_INEXISTANT = "00000000-0000-4000-8000-0000000000ff";

test("ATTAQUE-01 — cloison inter-établissement : un élève du lycée B n'atteint pas une séance du lycée A", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());

  // L'attaquant connaît l'UUID de la séance (il circule dans des liens) mais n'y a pas droit.
  const ecrit = await doitEchouer(() => marquer(db, ACTEURS.eleveB, OBJETS.seanceA1, "Une fonction affine s'écrit f(x) = ax + b."));
  assert.match(ecrit.message, /NON_ACCESSIBLE/, "pas d'écriture sur la séance d'un autre établissement");

  // Un élève de la même école mais d'une autre classe non plus (déjà vu INCOMPRIS-02, on le re-affirme ici).
  const autreClasse = await doitEchouer(() => marquer(db, ACTEURS.eleveA2Samir, OBJETS.seanceA1, "Une fonction affine s'écrit f(x) = ax + b."));
  assert.match(autreClasse.message, /NON_ACCESSIBLE/);
});

test("ATTAQUE-02 — l'agrégat professeur ne fuit pas vers un autre établissement", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());
  await marquer(db, ACTEURS.eleveA1Rayan, OBJETS.seanceA1, "Pour x = 3, f(3) = 7.");

  // Professeur d'un autre établissement : la fonction par séance refuse,
  const profEtranger = await doitEchouer(() => lirePour(db, ACTEURS.profAutre, "select * from study.passages_incompris_seance($1)", [OBJETS.seanceA1]));
  assert.match(profEtranger.message, /NON_ACCESSIBLE/);
  // et le résumé ne lui montre aucune ligne de l'établissement voisin.
  assert.equal((await lirePour(db, ACTEURS.adminB, "select * from study.passages_incompris_resume()")).length, 0, "l'admin B ne voit rien du lycée A");

  // Un camarade ne peut pas se faire passer pour professeur pour lire l'agrégat.
  const eleve = await doitEchouer(() => lirePour(db, ACTEURS.eleveA1Lina, "select * from study.passages_incompris_seance($1)", [OBJETS.seanceA1]));
  assert.match(eleve.message, /NON_ACCESSIBLE/);
});

test("ATTAQUE-03 — IDOR « c'est compris » : on ne touche que ses propres lignes", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());
  const [{ id }] = await marquer(db, ACTEURS.eleveA1Rayan, OBJETS.seanceA1, "Le coefficient directeur est a.");

  // Un camarade de classe connaît l'UUID du passage mais ne peut pas le clore.
  const camarade = await doitEchouer(() => lirePour(db, ACTEURS.eleveA1Lina, "select study.passage_incompris_compris($1)", [id]));
  assert.match(camarade.message, /NON_ACCESSIBLE/);
  // Un élève d'un autre établissement non plus.
  const etranger = await doitEchouer(() => lirePour(db, ACTEURS.eleveB, "select study.passage_incompris_compris($1)", [id]));
  assert.match(etranger.message, /NON_ACCESSIBLE/);
  // Un UUID qui n'existe pas est refusé pareil (pas d'oracle « existe / existe pas »).
  const fantome = await doitEchouer(() => lirePour(db, ACTEURS.eleveA1Rayan, "select study.passage_incompris_compris($1)", [UUID_INEXISTANT]));
  assert.match(fantome.message, /NON_ACCESSIBLE/);

  // Après tout ça, la ligne de l'auteur est toujours ouverte : rien n'a été clos par un tiers.
  const [{ compris_le }] = await lirePour(db, ACTEURS.eleveA1Rayan, "select compris_le from study.passages_incompris where id = $1", [id]);
  assert.equal(compris_le, null);
});

test("ATTAQUE-04 — inondation : le plafond de 30 passages ouverts tient", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());

  for (let i = 0; i < 30; i++) await marquer(db, ACTEURS.eleveA1Rayan, OBJETS.seanceA1, `Passage distinct numéro ${i} de la séance.`);
  const ouverts = await lirePour(db, ACTEURS.eleveA1Rayan, "select count(*)::int as n from study.passages_incompris where compris_le is null");
  assert.equal(ouverts[0].n, 30);

  const trop = await doitEchouer(() => marquer(db, ACTEURS.eleveA1Rayan, OBJETS.seanceA1, "Un trente-et-unième passage de trop."));
  assert.match(trop.message, /TROP_DE_PASSAGES/);

  // Clore un passage libère une place : le plafond borne l'ouvert, pas le total historique.
  const [{ id }] = await lirePour(db, ACTEURS.eleveA1Rayan, "select id from study.passages_incompris where compris_le is null limit 1");
  await lirePour(db, ACTEURS.eleveA1Rayan, "select study.passage_incompris_compris($1)", [id]);
  const encore = await marquer(db, ACTEURS.eleveA1Rayan, OBJETS.seanceA1, "Un passage ajouté après en avoir clos un.");
  assert.ok(encore[0].id, "une place libérée, un nouveau signalement passe");
});

test("ATTAQUE-05 — un brouillon non publié reste invisible même avec son UUID", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());
  const brouillon = await doitEchouer(() => marquer(db, ACTEURS.eleveA1Rayan, OBJETS.seanceA1Brouillon, "Un passage pêché dans un brouillon."));
  assert.match(brouillon.message, /NON_ACCESSIBLE/, "une séance non publiée ne se signale pas");
});
