import assert from "node:assert/strict";
import test from "node:test";
import { prioritesDevoirs } from "../../src/lib/priorites-devoirs.ts";

test("les brouillons sont distincts des travaux publiés", () => {
  const liste = [
    { etat: "brouillon", echeance: null },
    { etat: "publie", echeance: null },
    { etat: "archive", echeance: null },
  ];
  const resume = prioritesDevoirs(liste);
  assert.equal(resume.brouillons.length, 1);
  assert.equal(resume.actifs.length, 1);
});

test("les échéances de la semaine ne comprennent ni le passé ni les devoirs invisibles", () => {
  const maintenant = new Date("2026-11-27T12:00:00Z");
  const liste = [
    { etat: "publie", echeance: "2026-11-28T12:00:00Z" },
    { etat: "publie", echeance: "2026-12-12T12:00:00Z" },
    { etat: "publie", echeance: "2026-11-26T12:00:00Z" },
    { etat: "brouillon", echeance: "2026-11-28T12:00:00Z" },
    { etat: "ferme", echeance: "2026-11-28T12:00:00Z" },
  ];
  assert.deepEqual(prioritesDevoirs(liste, maintenant).aRendreBientot, [liste[0]]);
});
