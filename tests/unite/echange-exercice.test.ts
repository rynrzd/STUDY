import assert from "node:assert/strict";
import test from "node:test";
import { importerExercice, exporterExercice } from "../../src/lib/revision/echange-exercice.ts";
import { lireExercice } from "../../src/lib/revision/validation-exercice.ts";
function source() {
  const f = new FormData();
  for (const [k,v] of Object.entries({kind:"qcm", enonce:"L’eau bout-elle toujours à 100 °C ?", bonne:"2", explication:"Cela dépend de la pression.", indice:"Pensez à l’altitude.", exercice:"secret-id", notion:"notion-id"})) f.set(k,v);
  f.append("choix","Vrai"); f.append("choix","Faux");
  return lireExercice(f);
}
test("export/import conserve accents, correction et indices sans identifiants", () => {
  const texte = exporterExercice(source());
  assert.ok(!texte.includes("secret-id")); assert.ok(!texte.includes("notion-id"));
  const e = importerExercice(texte);
  assert.deepEqual(e.bonne, {index:1}); assert.deepEqual(e.choix,["Vrai","Faux"]);
  assert.equal(e.valeurs.indice,"Pensez à l’altitude."); assert.equal(e.valeurs.exercice,""); assert.equal(e.valeurs.notion,"");
});
test("un fichier non conforme n'atteint pas le formulaire", () => {
  for (const fichier of ["{", "null", "[]", JSON.stringify({format:"study.exercice",version:2,contenu:{}}), " ".repeat(65537)]) assert.throws(()=>importerExercice(fichier));
  const modifie=JSON.parse(exporterExercice(source())); modifie.contenu.bonne="8";
  assert.throws(()=>importerExercice(JSON.stringify(modifie)));
});
test("les identifiants injectes dans un fichier ne sont pas repris", () => {
  const f=JSON.parse(exporterExercice(source())); f.contenu.exercice="foreign"; f.contenu.notion="foreign";
  assert.equal(importerExercice(JSON.stringify(f)).valeurs.exercice,"");
  assert.equal(importerExercice(JSON.stringify(f)).valeurs.notion,"");
});
