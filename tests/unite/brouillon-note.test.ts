import test from "node:test";
import assert from "node:assert/strict";
import { cleBrouillonNote, garderBrouillon, retirerBrouillonConfirme } from "../../src/lib/v6/brouillon-note.ts";

test("deux comptes sur la même séance ne partagent pas leur clé de brouillon", () => {
  assert.notEqual(cleBrouillonNote("A", "cours", true), cleBrouillonNote("B", "cours", true));
  assert.notEqual(cleBrouillonNote("A:B", "C", true), cleBrouillonNote("A", "B:C", true));
});
test("sans autorisation locale aucune écriture n'est effectuée", () => {
  const cle = cleBrouillonNote("A", "cours", false);
  assert.equal(cle, null);
  assert.equal(garderBrouillon({ setItem() { assert.fail("écriture interdite"); } }, cle, "privé"), false);
});
test("une ancienne sauvegarde confirmée conserve la nouvelle saisie", () => {
  const m = new Map<string, string>();
  const stockage = { getItem: (k: string) => m.get(k) ?? null, setItem: (k: string, v: string) => { m.set(k, v); }, removeItem: (k: string) => { m.delete(k); } };
  const a = cleBrouillonNote("A", "cours", true)!;
  const b = cleBrouillonNote("B", "cours", true)!;
  garderBrouillon(stockage, a, "ancien");
  garderBrouillon(stockage, a, "nouveau");
  garderBrouillon(stockage, b, "autre compte");
  retirerBrouillonConfirme(stockage, a, "ancien");
  assert.equal(m.get(a), "nouveau");
  retirerBrouillonConfirme(stockage, a, "nouveau");
  assert.equal(m.has(a), false);
  assert.equal(m.get(b), "autre compte");
});
test("stockage bloqué : ne pas annoncer une copie sauvegardée", () => {
  assert.equal(garderBrouillon({ setItem() { throw new Error("quota"); } }, "cle", "note"), false);
});
