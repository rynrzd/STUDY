import test from "node:test";
import assert from "node:assert/strict";
import { normaliserSaisieCode } from "../../src/lib/saisie-code.ts";

test("le code peut être collé avec des espaces ou des tirets", () => {
  assert.equal(normaliserSaisieCode("12 34-56"), "123456");
});

test("seuls les six premiers chiffres ASCII sont conservés", () => {
  assert.equal(normaliserSaisieCode("Code : 001234 (valide 5 min)"), "001234");
  assert.equal(normaliserSaisieCode("abc"), "");
  assert.equal(normaliserSaisieCode("９８７６５４"), "");
});
