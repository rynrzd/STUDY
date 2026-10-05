// =============================================================================
// Study V6 — lectures d'affichage (migration 0053) : noms sans annuaire.
// =============================================================================

import { test } from "node:test";
import assert from "node:assert/strict";
import { ACTEURS, OBJETS, baseDeTest, doitEchouer, lirePour } from "./harness.mjs";

test("Noms d'affichage : seulement les personnes proches, sans adresse", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());
  const tous = [ACTEURS.profMartin, ACTEURS.eleveA1Lina, ACTEURS.eleveA2Samir, ACTEURS.eleveB, ACTEURS.profAutre, ACTEURS.adminA];
  const vus = await lirePour(db, ACTEURS.eleveA1Rayan, "select * from study.noms_affichables($1)", [tous]);
  const parId = new Map(vus.map((v) => [v.id, v]));
  assert.equal(parId.get(ACTEURS.profMartin)?.affichage, "Helene Martin", "son professeur, nom complet");
  assert.equal(parId.get(ACTEURS.eleveA1Lina)?.affichage, "Lina B.", "une camarade, prenom et initiale");
  assert.ok(!parId.has(ACTEURS.eleveA2Samir), "une autre classe : absent");
  assert.ok(!parId.has(ACTEURS.eleveB), "un autre lycee : absent");
  assert.ok(!parId.has(ACTEURS.profAutre), "un professeur qui ne m'enseigne pas : absent");
  for (const v of vus) assert.ok(!Object.values(v).some((x) => typeof x === "string" && x.includes("@")), "aucune adresse");

  // Le professeur voit ses eleves des deux classes, pas ceux du lycee B.
  const parProf = await lirePour(db, ACTEURS.profMartin, "select id from study.noms_affichables($1)", [tous]);
  const ids = parProf.map((v) => v.id);
  assert.ok(ids.includes(ACTEURS.eleveA2Samir));
  assert.ok(!ids.includes(ACTEURS.eleveB));
});

test("Mes cours : nombre reel de seances, professeurs nommes, rien d'une autre classe", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());
  const cours = await lirePour(db, ACTEURS.eleveA1Rayan, "select * from study.mes_cours()");
  const maths = cours.find((c) => c.id === OBJETS.espaceMathsA1);
  assert.equal(maths.seances, 1, "le brouillon ne compte pas");
  assert.equal(maths.enseignants, "Helene Martin");
  assert.equal(maths.chapitre_courant, "Chapitre 1 - Fonctions affines");
  assert.ok(!cours.some((c) => c.id === OBJETS.espaceMathsA2));
});

test("Membres de classe : roles publics pour l'eleve, etat du compte pour l'equipe", async (t) => {
  const db = await baseDeTest();
  t.after(() => db.close());
  const parEleve = await lirePour(db, ACTEURS.eleveA1Rayan, "select * from study.membres_classe($1)", [OBJETS.classeA1]);
  assert.ok(parEleve.length >= 4);
  assert.ok(parEleve.every((m) => m.etat_compte === null), "l'eleve ne voit pas l'etat des comptes");
  const parProf = await lirePour(db, ACTEURS.profMartin, "select * from study.membres_classe($1)", [OBJETS.classeA1]);
  assert.ok(parProf.some((m) => m.etat_compte === "actif"));
  const intrus = await doitEchouer(() => lirePour(db, ACTEURS.eleveA2Samir, "select * from study.membres_classe($1)", [OBJETS.classeA1]));
  assert.match(intrus.message, /NON_ACCESSIBLE/);
});
