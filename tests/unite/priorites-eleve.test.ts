import assert from "node:assert/strict";
import test from "node:test";
import { classerDevoirsEleve } from "../../src/lib/priorites-eleve.ts";

const moment = new Date("2026-11-27T12:00:00Z");

function devoir(etat: string, echeance: string | null, remise = "non_commence", corrige = false) {
  return { devoir: { etat, echeance }, etat: remise, corrige };
}

test("les devoirs proches, éloignés et sans date sont séparés", () => {
  const urgent = devoir("publie", "2026-11-28T12:00:00Z");
  const tardif = devoir("publie_en_retard", "2026-11-25T12:00:00Z");
  const loin = devoir("publie", "2026-12-20T12:00:00Z");
  const sansDate = devoir("publie", null);
  const classes = classerDevoirsEleve([loin, urgent, sansDate, tardif], moment);
  assert.deepEqual(classes.bientot, [tardif, urgent]);
  assert.deepEqual(classes.plusTard, [loin, sansDate]);
  assert.equal(classes.nombreAFaire, 4);
});

test("remis, corrigés et fermés ne reviennent jamais dans À faire", () => {
  const remis = devoir("publie", "2026-11-28T12:00:00Z", "remis");
  const retour = devoir("publie", null, "retour_disponible");
  const corrige = devoir("publie", null, "non_commence", true);
  const ferme = devoir("ferme", "2026-11-25T12:00:00Z");
  const reprise = devoir("publie", null, "a_reprendre");
  const groupes = classerDevoirsEleve([remis, retour, corrige, ferme, reprise], moment);
  assert.equal(groupes.nombreAFaire, 1);
  assert.deepEqual(groupes.plusTard, [reprise]);
  assert.equal(groupes.termines.length, 4);
});
