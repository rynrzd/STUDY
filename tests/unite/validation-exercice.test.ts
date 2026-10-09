import assert from "node:assert/strict";
import test from "node:test";
import { lireExercice, testerReponse } from "../../src/lib/revision/validation-exercice.ts";
function exercice(changements: Record<string, string> = {}, choix = ["Paris", "Lyon", "Marseille"]) {
  const f = new FormData();
  for (const [k, v] of Object.entries({kind:"qcm", enonce:"Quelle est la capitale ?", bonne:"1", explication:"Paris est la capitale de la France.", ...changements})) f.set(k, v);
  for (const c of choix) f.append("choix", c);
  return lireExercice(f);
}
test("un choix vide intermediaire ne decale jamais la bonne reponse", () => {
  const e = exercice({bonne:"3"}, ["Paris", "", "Lyon"]);
  assert.equal(e.valide, false);
  assert.deepEqual(e.bonne, {index:2});
  assert.ok(e.champs.choix);
});
test("lignes facultatives finales, doublons et debordements", () => {
  assert.equal(exercice({}, ["Paris", "Lyon", "", ""]).valide, true);
  assert.equal(exercice({}, ["Paris", " paris "]).valide, false);
  assert.equal(exercice({}, Array.from({length:9}, (_,i)=>String(i))).valide, false);
  assert.equal(exercice({enonce:"x".repeat(4001)}).valide, false);
  assert.equal(exercice({bonne:"2.5"}).valide, false);
});
test("nombres francais et tolerance strictement valide", () => {
  const e = exercice({kind:"numerique", bonne:"3,2", tolerance:"0,1"});
  assert.equal(e.valide, true);
  assert.equal(testerReponse(e.bonne,"3,3"), true);
  assert.equal(testerReponse(e.bonne,"3,31"), false);
  assert.equal(testerReponse(e.bonne,""), null);
  for (const tolerance of ["-1", "Infinity", "abc"]) assert.equal(exercice({kind:"numerique",bonne:"3",tolerance}).valide, false);
  assert.equal(exercice({kind:"numerique",bonne:"9".repeat(400)}).valide,false);
});
test("vrai faux conserve le contrat qcm et le texte n'est pas note", () => {
  const e=exercice({bonne:"2"},["Vrai","Faux"]);
  assert.equal(e.valide,true);
  assert.equal(testerReponse(e.bonne,"1"),true);
  assert.equal(testerReponse(e.bonne,"0"),false);
  assert.equal(testerReponse(exercice({kind:"texte"}).bonne,"ma reponse"),null);
});

test("la tolerance nulle ne transforme pas une petite erreur en reussite", () => {
  assert.equal(testerReponse({valeur:0, tolerance:0}, "0.0000000000000001"), false);
});
