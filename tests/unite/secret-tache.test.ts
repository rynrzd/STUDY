import assert from "node:assert/strict";
import test from "node:test";
import { secretTacheValide } from "../../src/lib/secret-tache.ts";

/**
 * Le secret des appels de service (file de travaux, sonde d'état détaillée).
 * Sans secret configuré, rien ne passe — pas même un en-tête vide.
 */
test("secret de tâche : accepté seulement s'il est configuré et identique", () => {
  const avant = process.env.CRON_SECRET;
  try {
    delete process.env.CRON_SECRET;
    assert.equal(secretTacheValide("Bearer x"), false, "aucun secret configuré : refus");
    assert.equal(secretTacheValide(null), false);

    process.env.CRON_SECRET = "secret-de-test";
    assert.equal(secretTacheValide("Bearer secret-de-test"), true);
    assert.equal(secretTacheValide("bearer secret-de-test"), true, "préfixe insensible à la casse");
    assert.equal(secretTacheValide("secret-de-test"), true, "sans préfixe");
    assert.equal(secretTacheValide("Bearer secret-de-tes"), false, "préfixe du secret refusé");
    assert.equal(secretTacheValide("Bearer "), false, "en-tête vide refusé");
    assert.equal(secretTacheValide(null), false);
  } finally {
    if (avant === undefined) delete process.env.CRON_SECRET;
    else process.env.CRON_SECRET = avant;
  }
});
