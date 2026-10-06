// =============================================================================
// Tests unitaires — connexion simplifiée : contexte établissement, lien
// d'invitation collé, référence d'accusé, cookie d'appareil partagé,
// redirections internes.
// =============================================================================

import test from "node:test";
import assert from "node:assert/strict";
import {
  decoderContexte,
  encoderContexte,
  jetonDepuisLien,
  normaliserCode,
  politiqueApresConnexion,
  referenceDemande,
} from "../../src/lib/v6/contexte-etablissement.ts";
import { cookieSession } from "../../src/lib/session.ts";
import { suiteSure } from "../../src/lib/v6/redirection.ts";

test("le code établissement est normalisé, et refusé s'il est mal formé", () => {
  assert.equal(normaliserCode(" testa1 "), "TESTA1");
  assert.equal(normaliserCode("LYC-4821"), "LYC-4821");
  for (const mauvais of ["", "abc", "A".repeat(17), "TEST A1", "x'; drop", null, undefined]) {
    assert.equal(normaliserCode(mauvais as string), null, String(mauvais));
  }
});

test("le contexte mémorisé ne porte que le code et le nom, et toute altération est ignorée", () => {
  const brut = encoderContexte({ code: "TESTA1", nom: "Lycée de démonstration" });
  assert.deepEqual(decoderContexte(brut), { code: "TESTA1", nom: "Lycée de démonstration" });
  assert.deepEqual(Object.keys(JSON.parse(Buffer.from(brut, "base64url").toString("utf8"))).sort(), ["c", "n"]);
  assert.equal(decoderContexte("pas-du-base64-json"), null);
  assert.equal(decoderContexte(Buffer.from(JSON.stringify({ c: "bad code!", n: "X" })).toString("base64url")), null);
  assert.equal(decoderContexte(Buffer.from(JSON.stringify({ c: "TESTA1", n: "" })).toString("base64url")), null);
  assert.equal(decoderContexte("x".repeat(700)), null);
});

test("politique : mémoriser sur appareil personnel, jamais sur appareil partagé", () => {
  assert.deepEqual(politiqueApresConnexion("personnel"), { memoriser: true, effacerParcours: true });
  assert.deepEqual(politiqueApresConnexion("partage"), { memoriser: false, effacerParcours: true });
});

test("un lien d'invitation collé est reconnu ; rien d'autre ne l'est", () => {
  const jeton = "Ab_-".repeat(11);
  assert.equal(jetonDepuisLien(`https://avecstudy.fr/invitation/${jeton}`), jeton);
  assert.equal(jetonDepuisLien(`  https://avecstudy.fr/invitation/${jeton}?utm=x  `), jeton);
  assert.equal(jetonDepuisLien(jeton), jeton);
  assert.equal(jetonDepuisLien("TESTA1"), null);
  assert.equal(jetonDepuisLien("https://avecstudy.fr/invitation/court"), null);
  assert.equal(jetonDepuisLien(`https://avecstudy.fr/invitation/${jeton}<script>`), null);
});

test("la référence d'accusé a la forme attendue par la base, sans caractère ambigu", () => {
  for (let i = 0; i < 200; i += 1) {
    const r = referenceDemande(crypto.getRandomValues(new Uint8Array(8)));
    assert.match(r, /^[A-HJ-NP-Z2-9]{4}-[A-HJ-NP-Z2-9]{4}$/u);
  }
});

test("appareil partagé : cookie de session de navigateur (sans durée) ; personnel : durée de la session", () => {
  assert.equal(cookieSession("j", 3600, false).maxAge, undefined);
  assert.equal(cookieSession("j", 3600, true).maxAge, 3600);
  assert.equal(cookieSession("j", 3600).maxAge, 3600, "par défaut, comportement inchangé");
  assert.equal(cookieSession("j", 3600, false).httpOnly, true);
});

test("la reprise de parcours ne suit que des routes internes, y compris les nouvelles", () => {
  assert.equal(suiteSure("/administration/etablissements"), "/administration/etablissements");
  assert.equal(suiteSure("/acces-en-attente"), "/acces-en-attente");
  for (const piege of ["https://exemple.org", "//exemple.org/app", "/\\exemple.org", "javascript:alert(1)", "/connexion", "/admin-pirate"]) {
    assert.equal(suiteSure(piege), null, piege);
  }
});
