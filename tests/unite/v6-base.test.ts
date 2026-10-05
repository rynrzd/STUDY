import assert from "node:assert/strict";
import test from "node:test";
import { codeStable, traduire } from "../../src/lib/v6/erreurs.ts";
import { suiteSure, versConnexion } from "../../src/lib/v6/redirection.ts";

/**
 * AUTH-03 — une redirection injectée vers l'extérieur est refusée.
 * Chaque forme ci-dessous a déjà servi à contourner un contrôle naïf.
 */
test("AUTH-03 : seules les routes internes de l'application sont acceptees", () => {
  assert.equal(suiteSure("/app/seances/1b2c?onglet=exercices#bloc-3"), "/app/seances/1b2c?onglet=exercices#bloc-3");
  assert.equal(suiteSure("/professeur/devoirs"), "/professeur/devoirs");
  for (const piege of [
    "https://evil.example/app",
    "//evil.example/app",
    "/\\evil.example",
    "\\\\evil.example",
    "javascript:alert(1)",
    "/app\u0000/x",
    "/connexion",
    "/",
    "app/cours",
    "/apple",
    "/app/../../etc",
    "",
    null,
    undefined,
  ]) {
    const resultat = suiteSure(piege as string);
    assert.ok(resultat === null || resultat.startsWith("/app"), `refus attendu pour ${String(piege)}`);
  }
  assert.equal(suiteSure("/app/../connexion"), null, "la normalisation ne fait pas sortir de /app");
  assert.equal(versConnexion("//evil.example"), "/connexion");
  assert.equal(versConnexion("/app/cours", "expiree"), "/connexion?suite=%2Fapp%2Fcours&motif=expiree");
});

test("Erreurs : code stable traduit au format du contrat, jamais de detail SQL", () => {
  assert.equal(codeStable("NON_ACCESSIBLE"), "NON_ACCESSIBLE");
  assert.equal(codeStable('ERROR: VERSION_CONFLICT (SQLSTATE 40001)'), "VERSION_CONFLICT");
  const e = traduire({ message: "TROP_RAPIDE" }, "req-1");
  assert.equal(e.code, "RATE_LIMITED");
  assert.equal(e.retryAfterSeconds, 10);
  assert.equal(e.requestId, "req-1");

  const brut = traduire({ message: 'relation "study.secret" does not exist', code: "42P01" }, "req-2");
  assert.equal(brut.code, "SERVER_ERROR");
  assert.ok(!brut.message.includes("study."), "aucun nom de table ne fuit");
  assert.equal(traduire({ message: "x", code: "42501" }, "r").code, "NOT_ACCESSIBLE");
  assert.equal(traduire({ message: "permission denied", code: "28000" }, "r").code, "UNAUTHENTICATED");
});
