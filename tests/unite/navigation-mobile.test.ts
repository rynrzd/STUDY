import assert from "node:assert/strict";
import test from "node:test";
import { destinationActive, indexNavigationMobile } from "../../src/lib/navigation-mobile.ts";

const principales = [
  { href: "/professeur", exact: true },
  { href: "/professeur/classes", aussi: ["/app/classes"] },
  { href: "/studio", aussi: ["/professeur/studio"] },
  { href: "/professeur/devoirs" },
] as const;
const autres = [{ href: "/app/agenda" }, { href: "/aide" }] as const;

test("navigation : la racine professeur n'absorbe pas toutes les pages", () => {
  assert.equal(destinationActive("/professeur", principales[0]), true);
  assert.equal(destinationActive("/professeur/classes", principales[0]), false);
});

test("navigation : chaque route retrouve son onglet et ses sous-pages", () => {
  assert.equal(indexNavigationMobile("/professeur", principales, autres), 0);
  assert.equal(indexNavigationMobile("/professeur/classes/une-classe", principales, autres), 1);
  assert.equal(indexNavigationMobile("/app/classes/une-classe", principales, autres), 1);
  assert.equal(indexNavigationMobile("/studio/seance/exercices", principales, autres), 2);
  assert.equal(indexNavigationMobile("/professeur/devoirs/123", principales, autres), 3);
});

test("navigation : le cinquième emplacement regroupe les destinations Plus", () => {
  assert.equal(indexNavigationMobile("/app/agenda", principales, autres), 4);
  assert.equal(indexNavigationMobile("/aide", principales, autres), 4);
  assert.equal(indexNavigationMobile("/app/agendaire", principales, autres), -1);
  assert.equal(indexNavigationMobile("/professeur/inconnue", principales, autres), -1);
});
