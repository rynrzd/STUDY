import assert from "node:assert/strict";
import test from "node:test";
import { champsEcheanceDevoir, echeanceDevoirVersIso } from "../../src/lib/echeances-devoirs.ts";

test("l'échéance suit l'heure de Paris, en été et en hiver", () => {
  assert.equal(echeanceDevoirVersIso("2026-07-15", "08:30"), "2026-07-15T06:30:00.000Z");
  assert.equal(echeanceDevoirVersIso("2026-12-15", "08:30"), "2026-12-15T07:30:00.000Z");
  assert.equal(echeanceDevoirVersIso("2026-12-15", ""), "2026-12-15T22:59:00.000Z");
  assert.equal(echeanceDevoirVersIso("", ""), null);
});

test("l'édition ne décale pas la date du jour à minuit", () => {
  const original = "2026-12-14T23:30:00.000Z";
  const champs = champsEcheanceDevoir(original);
  assert.deepEqual(champs, { date: "2026-12-15", heure: "00:30" });
  assert.equal(echeanceDevoirVersIso(champs.date, champs.heure), original);
  assert.deepEqual(champsEcheanceDevoir(null), { date: "", heure: "" });
});

test("les jours et heures qui n'existent pas sont refusés", () => {
  assert.equal(echeanceDevoirVersIso("2026-02-30", "12:00"), null);
  assert.equal(echeanceDevoirVersIso("2026-03-29", "02:30"), null);
});
