import assert from "node:assert/strict";
import test from "node:test";
import { jourParis, lundiDe, semaineDepuis } from "../../src/lib/semaine.ts";

/**
 * « Ta semaine » : lundi → dimanche, heure de Paris, jamais une série. Un jour
 * manqué n'efface rien ; la semaine suivante repart vide.
 */

test("le lundi d'une semaine, y compris un dimanche et un lundi", () => {
  assert.equal(lundiDe("2026-10-11"), "2026-10-05", "dimanche 11 → lundi 5");
  assert.equal(lundiDe("2026-10-05"), "2026-10-05", "un lundi est son propre lundi");
  assert.equal(lundiDe("2026-10-08"), "2026-10-05");
  assert.equal(lundiDe("2026-03-01"), "2026-02-23", "à cheval sur deux mois");
});

test("les jours d'entraînement de la semaine s'allument, ceux d'avant ou d'après non", () => {
  const s = semaineDepuis(["2026-10-05", "2026-10-06", "2026-10-06", "2026-10-08", "2026-10-04", "2026-10-12"], "2026-10-09");
  assert.deepEqual(s.jours, [true, true, false, true, false, false, false]);
  assert.equal(s.aujourdHui, 4, "vendredi");
  assert.equal(s.actifs, 3, "un jour compté une fois, même avec plusieurs tentatives");
});

test("un jour manqué ne remet rien à zéro", () => {
  const s = semaineDepuis(["2026-10-05", "2026-10-07"], "2026-10-08");
  assert.equal(s.actifs, 2);
  assert.equal(s.jours[1], false);
});

test("la date du jour suit l'heure de Paris, pas celle du serveur", () => {
  assert.equal(jourParis(new Date("2026-10-11T22:30:00Z")), "2026-10-12", "00 h 30 à Paris : déjà lundi");
  assert.equal(jourParis(new Date("2026-10-11T21:30:00Z")), "2026-10-11");
});
