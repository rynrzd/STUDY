import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const composant = readFileSync(new URL("../../src/components/study/classe-formulaires.tsx", import.meta.url), "utf8");
const styles = readFileSync(new URL("../../src/styles/globals.css", import.meta.url), "utf8");

test("l'impression nominative cible la fiche de l'élève, pas les autres invitations préparées", () => {
  assert.match(composant, /const idImpression = useId\(\)/u);
  assert.match(composant, /<FicheInvitationImprimable[^>]*id=\{idImpression\}/u);
  assert.match(composant, /onClick=\{\(\) => imprimerInvitation\(idImpression\)\}/u);
  assert.match(composant, /classList\.add\("fiche-impression--cible"\)/u);
  assert.match(styles, /body\.avec-fiche-cible \.fiche-impression:not\(\.fiche-impression--cible\)\s*\{\s*display: none !important/u);
  assert.match(styles, /body\.avec-fiche-cible \.fiche-impression--cible\s*\{[\s\S]*?page-break-after: auto !important/u);
  assert.match(composant, /window\.addEventListener\("afterprint", nettoyer\)/u);
});

test("un QR en retard ne peut plus remplacer celui d'une autre invitation", () => {
  assert.match(composant, /let actif = true/u);
  assert.match(composant, /if \(actif\) setImage\(url\)/u);
  assert.match(composant, /return \(\) => \{ actif = false; \}/u);
  assert.match(composant, /<CodeQr key=\{url\} texte=\{url\} nom=\{nom\}/u);
});
