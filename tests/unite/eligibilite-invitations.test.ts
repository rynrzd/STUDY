import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { peutPreparerInvitationEleve } from "../../src/lib/eligibilite-invitation.ts";

test("une invitation ordinaire est réservée aux élèves dont le compte reste à activer", () => {
  assert.equal(peutPreparerInvitationEleve("a_activer"), true);
  for (const etat of ["actif", "suspendu", null, undefined, "inconnu"]) {
    assert.equal(peutPreparerInvitationEleve(etat), false, `état ${String(etat)} refusé`);
  }
});

test("la page des membres masque l'action si le compte est déjà activé", () => {
  const source = readFileSync(new URL("../../src/app/app/classes/[classe]/membres/vue.tsx", import.meta.url), "utf8");
  assert.match(source, /peutPreparerInvitationEleve\(m\.etatCompte\)\s*\?\s*\(\s*<FormulaireInvitationEleve/u);
});

test("les classes professeur masquent également l'invitation sans état à activer", () => {
  const source = readFileSync(new URL("../../src/app/professeur/classes/page.tsx", import.meta.url), "utf8");
  assert.match(source, /creationAutonome && peutPreparerInvitationEleve\(eleve\.etatCompte\)\s*\?\s*\([\s\S]{0,600}<FormulaireInvitationEleve/u);
  assert.match(source, /eleves\.some\(\(eleve\) => peutPreparerInvitationEleve\(eleve\.etatCompte\)\)/u);
});
