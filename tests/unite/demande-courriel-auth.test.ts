import assert from "node:assert/strict";
import test from "node:test";
import { demanderCourrielAuth } from "../../src/lib/demande-courriel-auth.ts";

test("l'inscription distingue refus SMTP, quota, panne réseau et demande acceptée", async () => {
  assert.equal(await demanderCourrielAuth("inscription", async () => ({ error: { status: 500 } })), "indisponible");
  assert.equal(await demanderCourrielAuth("inscription", async () => ({ error: { status: 429 } })), "limite");
  assert.equal(await demanderCourrielAuth("inscription", async () => { throw Error(); }), "indisponible");
  assert.equal(await demanderCourrielAuth("inscription", async () => ({ error: null })), "indisponible");
  for (const reponse of [{ error: null, data: { user: {} } }, { error: { code: "user_already_exists" } }]) {
    assert.equal(await demanderCourrielAuth("inscription", async () => reponse), "neutre");
  }
});

test("une session immédiate est fermée et ne déclenche pas l’écran de confirmation", async () => {
  let ferme = false;
  const resultat = await demanderCourrielAuth("inscription", async () => ({ data: { session: {} }, error: null }), async () => { ferme = true; });
  assert.equal(ferme, true);
  assert.equal(resultat, "indisponible");
});

test("renvoi et récupération gardent le même résultat quelle que soit l’adresse", async () => {
  for (const mode of ["confirmation", "recuperation"] as const) {
    for (const error of [null, { code: "user_not_found" }, { status: 500 }, { status: 429 }]) {
      assert.equal(await demanderCourrielAuth(mode, async () => ({ error })), "neutre");
    }
  }
});
