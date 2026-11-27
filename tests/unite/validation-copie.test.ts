import assert from "node:assert/strict";
import test from "node:test";
import { verifierSelectionCopie } from "../../src/lib/validation-copie.ts";

test("une copie vide ne peut pas être envoyée", () => {
  assert.match(verifierSelectionCopie(null) ?? "", /Choisis un fichier/);
  assert.match(verifierSelectionCopie({ size: 0 }) ?? "", /Choisis un fichier/);
});

test("la limite est de quatre millions d'octets, comme sur le serveur", () => {
  assert.equal(verifierSelectionCopie({ size: 4_000_000 }), null);
  assert.match(verifierSelectionCopie({ size: 4_000_001 }) ?? "", /4 Mo/);
});
