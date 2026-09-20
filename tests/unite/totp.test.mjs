// =============================================================================
// TOTP de recette — conformité RFC 6238.
//
// Ce calcul mérite un test pour une raison précise : s'il était faux, la
// recette échouerait à se connecter et l'on conclurait que **le produit** a un
// défaut de second facteur. Un outil de mesure qui ment coûte plus cher que
// pas d'outil du tout.
//
// Les vecteurs ci-dessous sont ceux de la RFC 6238, annexe B (variante SHA-1).
// =============================================================================

import test from "node:test";
import assert from "node:assert/strict";
import { codeTotp, depuisBase32, secretDeLUri, finDeFenetre } from "../../scripts/recette/totp.mjs";

// « 12345678901234567890 » en ASCII, tel que la RFC le donne, réécrit en
// base32 puisque c'est la forme qu'utilisent les URI `otpauth:`.
const SECRET_RFC = "GEZDGNBVGY3TQOJQGEZDGNBVGY3TQOJQ";

test("totp — les vecteurs de la RFC 6238 sont reproduits", () => {
  const vecteurs = [
    [59, "94287082"],
    [1111111109, "07081804"],
    [1111111111, "14050471"],
    [1234567890, "89005924"],
    [2000000000, "69279037"],
    [20000000000, "65353130"],
  ];

  for (const [secondes, attendu] of vecteurs) {
    const obtenu = codeTotp(SECRET_RFC, { instant: secondes * 1000, chiffres: 8 });
    assert.equal(obtenu, attendu, `t = ${secondes}`);
  }
});

test("totp — le code fait six chiffres et change de fenetre en fenetre", () => {
  // Aligné sur une frontière de fenêtre : 1 700 000 010 = 56 666 667 × 30.
  const base = 1_700_000_010_000;

  const code = codeTotp(SECRET_RFC, { instant: base });
  assert.match(code, /^[0-9]{6}$/);

  // Dans la même fenêtre de trente secondes, le code ne bouge pas.
  assert.equal(codeTotp(SECRET_RFC, { instant: base + 29_000 }), code);

  // À la fenêtre suivante, il change.
  assert.notEqual(codeTotp(SECRET_RFC, { instant: base + 30_000 }), code);

  // Et `pas` désigne bien les fenêtres voisines : c'est ce qui permet à la
  // recette de présenter délibérément un code périmé.
  assert.equal(codeTotp(SECRET_RFC, { instant: base, pas: 1 }), codeTotp(SECRET_RFC, { instant: base + 30_000 }));
});

test("totp — le secret se lit tel qu il est affiche", () => {
  // Les applications affichent souvent le secret par groupes de quatre.
  const espace = "GEZD GNBV GY3T QOJQ GEZD GNBV GY3T QOJQ";
  assert.deepEqual(depuisBase32(espace), depuisBase32(SECRET_RFC));

  // Et le remplissage `=` est toléré.
  assert.deepEqual(depuisBase32("MZXW6==="), depuisBase32("mzxw6"));

  assert.throws(() => depuisBase32("GEZD1"), /base32 invalide/);
});

test("totp — le secret se retrouve dans une URI otpauth", () => {
  const uri = `otpauth://totp/AvecStudy:admin%40exemple?secret=${SECRET_RFC}&issuer=AvecStudy&algorithm=SHA1`;
  assert.equal(secretDeLUri(uri), SECRET_RFC);
  assert.throws(() => secretDeLUri("otpauth://totp/Sans?issuer=X"), /aucun secret/);
});

test("totp — la fin de fenetre reste dans les bornes", () => {
  const reste = finDeFenetre();
  assert.ok(reste > 0 && reste <= 30_000, `reste = ${reste}`);
});
