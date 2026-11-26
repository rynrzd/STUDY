import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";
import path from "node:path";
import { schemaConfirmationProfesseur } from "../../src/lib/confirmation-professeur.ts";

test("le code de confirmation accepte six chiffres et normalise l'adresse", () => {
  assert.deepEqual(
    schemaConfirmationProfesseur.parse({ email: "  Prof@Exemple.FR ", code: " 001234 " }),
    { email: "prof@exemple.fr", code: "001234" },
  );
});

test("le code de confirmation rejette une valeur mal formée", () => {
  for (const code of ["12345", "1234567", "12 456", "12a456", "１２３４５６", "", null, 123456]) {
    assert.equal(schemaConfirmationProfesseur.safeParse({ email: "prof@exemple.fr", code }).success, false);
  }
  assert.equal(schemaConfirmationProfesseur.safeParse({ email: "pas-un-email", code: "123456" }).success, false);
});

test("le modèle Supabase contient un code, sans dépendance à un lien de confirmation", () => {
  const contenu = readFileSync(path.resolve(import.meta.dirname, "../../docs/email/confirmation-professeur-code.html"), "utf8");
  assert.match(contenu, /\{\{\s*\.Token\s*\}\}/u);
  assert.doesNotMatch(contenu, /\{\{\s*\.(?:TokenHash|ConfirmationURL)\s*\}\}/u);
  assert.doesNotMatch(contenu, /<a\s/u);
});

test("chaque e-mail d'authentification possède une action adaptée à son usage", () => {
  const dossier = path.resolve(import.meta.dirname, "../../docs/email");
  const modeles = {
    "recuperation-mot-de-passe.html": /\{\{\s*\.RedirectTo\s*\}\}&amp;token_hash=\{\{\s*\.TokenHash\s*\}\}/u,
    "invitation.html": /\{\{\s*\.ConfirmationURL\s*\}\}/u,
    "connexion-par-email.html": /\{\{\s*\.Token\s*\}\}/u,
    "changement-adresse.html": /\{\{\s*\.NewEmail\s*\}\}/u,
    "verification-securite.html": /\{\{\s*\.Token\s*\}\}/u,
  };
  for (const [nom, obligation] of Object.entries(modeles)) {
    const contenu = readFileSync(path.join(dossier, nom), "utf8");
    assert.match(contenu, obligation, `${nom}: variable Supabase manquante`);
    assert.match(contenu, /lang="fr"/u, `${nom}: traduction française`);
    assert.match(contenu, /AvecStudy/u, `${nom}: marque`);
  }
});
