import test from "node:test";
import assert from "node:assert/strict";
import { etatPourRemisePapier, remiseEffectuee, remiseEnRetard } from "../../src/lib/suivi-remises.ts";

test("une copie corrigée reste une copie remise, même après changement d'état", () => {
  for (const etat of ["retour_disponible", "a_reprendre"]) {
    const ligne = { etat, derniere: { enRetard: false } };
    assert.equal(remiseEffectuee(ligne), true);
    assert.equal(remiseEnRetard(ligne), false);
    assert.equal(etatPourRemisePapier(ligne), "remis");
  }
});

test("une copie corrigée en retard garde son retard", () => {
  const ligne = { etat: "retour_disponible", derniere: { enRetard: true } };
  assert.equal(remiseEffectuee(ligne), true);
  assert.equal(remiseEnRetard(ligne), true);
  assert.equal(etatPourRemisePapier(ligne), "remis_en_retard");
});

test("une remise papier sans version est comptée et son sélecteur reste valide", () => {
  assert.equal(remiseEffectuee({ etat: "remis", derniere: null }), true);
  assert.equal(remiseEnRetard({ etat: "remis_en_retard", derniere: null }), true);
  assert.equal(etatPourRemisePapier({ etat: "remis_en_retard", derniere: null }), "remis_en_retard");
  assert.equal(etatPourRemisePapier({ etat: "non_commence", derniere: null }), "non_commence");
  assert.equal(remiseEffectuee({ etat: "brouillon", derniere: null }), false);
});
