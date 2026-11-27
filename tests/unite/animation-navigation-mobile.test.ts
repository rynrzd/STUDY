import assert from "node:assert/strict";
import test from "node:test";
import { etapeRessort } from "../../src/lib/animation-navigation-mobile.ts";

test("la bulle change réellement de position à chaque image puis atteint sa cible", () => {
  let position = 10;
  let vitesse = 0;
  const positions: number[] = [];
  for (let i = 0; i < 90; i++) {
    ({ position, vitesse } = etapeRessort(position, vitesse, 90));
    positions.push(position);
  }
  assert.ok((positions[0] ?? 10) > 10);
  assert.ok(new Set(positions.slice(0, 15).map((p) => p.toFixed(2))).size > 10);
  assert.ok(positions.every((p) => p >= 6 && p <= 94));
  assert.ok(Math.abs(position - 90) < 0.1);
  assert.ok(Math.abs(vitesse) < 0.1);
});

test("le ressort repart fluidement en sens inverse, même en cas de clic rapide", () => {
  let etat = { position: 90, vitesse: 0 };
  for (let i = 0; i < 8; i++) etat = etapeRessort(etat.position, etat.vitesse, 30);
  const miParcours = etat.position;
  for (let i = 0; i < 90; i++) etat = etapeRessort(etat.position, etat.vitesse, 70);
  assert.ok(miParcours < 90);
  assert.ok(Math.abs(etat.position - 70) < 0.1);
});

test("un ralentissement des images reste borné et déterministe", () => {
  const a = etapeRessort(10, 0, 90, 10);
  const b = etapeRessort(10, 0, 90, 2);
  assert.deepEqual(a, b);
  assert.ok(a.position > 10);
});
