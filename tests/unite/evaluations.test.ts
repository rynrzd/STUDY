import assert from "node:assert/strict";
import test from "node:test";
import { analyser, exportNotes, niveauMaitrise, noteSur20 } from "../../src/lib/evaluations/analyse.ts";
import {
  aleaDepuisGraine,
  evaluerExpression,
  genererCopie,
  permutation,
  problemeQuestion,
  rendreTexte,
  tirerValeurs,
  type QuestionModele,
} from "../../src/lib/evaluations/sujet.ts";

/**
 * Évaluations : le tirage d'un sujet par élève (ordre, choix, valeurs) et
 * l'analyse des résultats. L'attendu de chaque copie doit rester juste après
 * mélange — c'est la garantie centrale.
 */

test("expressions : priorités, puissance, fonctions, variables ; le reste est refusé", () => {
  assert.equal(evaluerExpression("2*a+b", { a: 3, b: 1 }), 7);
  assert.equal(evaluerExpression("2 + 3 × 4"), 14);
  assert.equal(evaluerExpression("-(a-5)^2", { a: 2 }), -9);
  assert.equal(evaluerExpression("sqrt(16) + abs(-2)"), 6);
  assert.equal(evaluerExpression("1,5 * 2"), 3, "virgule décimale");
  assert.equal(evaluerExpression("1/3"), 0.333333);
  assert.throws(() => evaluerExpression("process.exit()"), /variable inconnue|caractère/);
  assert.throws(() => evaluerExpression("a + 1"), /variable inconnue/);
  assert.throws(() => evaluerExpression("4 / (2 - 2)"), /division par zéro/);
  assert.throws(() => evaluerExpression("2 +"), /fin inattendue/);
});

test("rendre un énoncé : chaque {expression} prend sa valeur, à la française", () => {
  assert.equal(rendreTexte("f(x) = {a}x + {b}, calcule f({c})", { a: 2, b: 5, c: 3 }), "f(x) = 2x + 5, calcule f(3)");
  assert.equal(rendreTexte("Moitié : {a/2}", { a: 3 }), "Moitié : 1,5");
  assert.equal(rendreTexte("Sans variable.", {}), "Sans variable.");
});

test("tirage : bornes respectées, zéro exclu sur demande, reproductible avec la même graine", () => {
  const alea = aleaDepuisGraine("x");
  for (let k = 0; k < 200; k++) {
    const v = tirerValeurs({ a: { min: -3, max: 3, nonNul: true } }, alea);
    assert.ok(v.a! >= -3 && v.a! <= 3 && v.a !== 0);
  }
  assert.deepEqual(tirerValeurs({ a: { min: 1, max: 100 } }, aleaDepuisGraine("g")), tirerValeurs({ a: { min: 1, max: 100 } }, aleaDepuisGraine("g")));
  assert.deepEqual([...permutation(6, aleaDepuisGraine("p"))].sort(), [0, 1, 2, 3, 4, 5]);
});

const QUESTIONS: QuestionModele[] = [
  { id: "q1", kind: "qcm", enonce: "Image de 2 par f(x) = {a}x + {b} ?", choix: ["{2*a+b}", "{2*a-b}", "{a+b}", "{2+b}"], points: 2, parametres: { a: { min: 2, max: 9 }, b: { min: 1, max: 9 } } },
  { id: "q2", kind: "qcm_multiple", enonce: "Fonctions affines ?", choix: ["f(x)=3x", "g(x)=x²", "h(x)=2x+1", "k(x)=1/x"], points: 2, parametres: null },
  { id: "q3", kind: "numerique", enonce: "Calcule f({c}) pour f(x) = {a}x.", choix: null, points: 1, parametres: { a: { min: 2, max: 5 }, c: { min: 2, max: 5 } } },
  { id: "q4", kind: "redigee", enonce: "Explique.", choix: null, points: 3, parametres: null },
];
const CORRIGES = { q1: { index: 0 }, q2: { indices: [0, 2] }, q3: { formule: "a*c" }, q4: {} };

test("une copie : l'attendu suit le mélange des choix et les valeurs tirées", () => {
  for (const graine of ["eleve-1", "eleve-2", "eleve-3", "eleve-4"]) {
    const { sujet, attendus } = genererCopie(QUESTIONS, CORRIGES, { melangerQuestions: true, melangerChoix: true }, aleaDepuisGraine(graine));
    assert.equal(sujet.length, 4);
    assert.deepEqual(sujet.map((s) => s.ordre), [1, 2, 3, 4]);
    for (const s of sujet) {
      const a = attendus.find((x) => x.question_id === s.question_id)!;
      if (s.question_id === "q1") {
        // Le bon choix affiché vaut bien 2a + b, quel que soit le mélange.
        const m = /f\(x\) = (\d+)x \+ (\d+)/.exec(s.enonce)!;
        const attendu = 2 * Number(m[1]) + Number(m[2]);
        assert.equal(s.choix![a.attendu.index as number], String(attendu), `${graine} : ${s.enonce}`);
        assert.equal(a.permutation![a.attendu.index as number], 0, "la permutation ramène au choix d'origine");
      }
      if (s.question_id === "q2") {
        const affiches = (a.attendu.indices as number[]).map((i) => s.choix![i]);
        assert.deepEqual(affiches.sort(), ["f(x)=3x", "h(x)=2x+1"]);
      }
      if (s.question_id === "q3") {
        const m = /f\((\d+)\) pour f\(x\) = (\d+)x/.exec(s.enonce)!;
        assert.equal(a.attendu.valeur, Number(m[1]) * Number(m[2]));
      }
    }
    assert.equal(JSON.stringify(sujet).includes("index"), false, "le sujet ne contient jamais l'attendu");
  }
  const sansMelange = genererCopie(QUESTIONS, CORRIGES, { melangerQuestions: false, melangerChoix: false }, aleaDepuisGraine("z"));
  assert.deepEqual(sansMelange.sujet.map((s) => s.question_id), ["q1", "q2", "q3", "q4"]);
  assert.equal(sansMelange.attendus[0]!.attendu.index, 0);
});

test("contrôle avant distribution : chaque problème est nommé", () => {
  assert.equal(problemeQuestion(QUESTIONS[0]!, CORRIGES.q1), null);
  assert.match(problemeQuestion(QUESTIONS[0]!, {})!, /bonne réponse/);
  assert.match(problemeQuestion({ ...QUESTIONS[2]!, enonce: "f({z})" }, CORRIGES.q3)!, /variable inconnue/);
  assert.match(problemeQuestion({ id: "v", kind: "vrai_faux", enonce: "Vrai ?", choix: null, points: 1, parametres: null }, {})!, /vraie ou fausse/);
});

test("notation : note sur 20 au demi-point, quatre niveaux de maîtrise", () => {
  assert.equal(noteSur20(13, 16), 16.5);
  assert.equal(noteSur20(3, 8), 7.5);
  assert.equal(noteSur20(0, 0), null);
  assert.equal(niveauMaitrise(0.2), "non_acquis");
  assert.equal(niveauMaitrise(0.4), "fragile");
  assert.equal(niveauMaitrise(0.6), "satisfaisant");
  assert.equal(niveauMaitrise(0.9), "tres_bonne_maitrise");
});

test("analyse : la mauvaise réponse la plus choisie est retrouvée malgré le mélange des choix", () => {
  const questions = [
    { id: "q1", ordre: 1, kind: "qcm" as const, enonce: "Image de 2 ?", choix: ["3", "1", "-1"], points: 2, notionId: "n1", notion: "Images" },
    { id: "q2", ordre: 2, kind: "redigee" as const, enonce: "Explique.", choix: null, points: 2, notionId: "n2", notion: "Méthode" },
  ];
  const copie = (id: string, nom: string, rendue = true) => ({ id, profileId: `p-${id}`, prenom: nom, nom, commenceeLe: rendue ? "t" : null, rendueLe: rendue ? "t" : null, sortiesOnglet: 0 });
  // Trois élèves voient les choix dans des ordres différents ; deux choisissent « 1 » (index d'origine 1).
  const attendus = [
    { copieId: "a", questionId: "q1", permutation: [0, 1, 2] },
    { copieId: "b", questionId: "q1", permutation: [2, 1, 0] },
    { copieId: "c", questionId: "q1", permutation: [1, 0, 2] },
  ];
  const reponses = [
    { copieId: "a", questionId: "q1", reponse: { index: 0 } }, // « 3 » juste
    { copieId: "b", questionId: "q1", reponse: { index: 1 } }, // « 1 »
    { copieId: "c", questionId: "q1", reponse: { index: 0 } }, // « 1 »
  ];
  const corrections = [
    { copieId: "a", questionId: "q1", points: 2, juste: true, automatique: true, commentaire: null },
    { copieId: "b", questionId: "q1", points: 0, juste: false, automatique: true, commentaire: null },
    { copieId: "c", questionId: "q1", points: 0, juste: false, automatique: true, commentaire: null },
    { copieId: "a", questionId: "q2", points: 2, juste: true, automatique: false, commentaire: null },
  ];
  const r = analyser({ questions, copies: [copie("a", "Ana"), copie("b", "Bea"), copie("c", "Cyr"), copie("d", "Dan", false)], attendus, reponses, corrections, support: "en_ligne" });

  const q1 = r.questions.find((q) => q.id === "q1")!;
  assert.equal(q1.erreurPrincipale?.libelle, "1");
  assert.ok(Math.abs(q1.erreurPrincipale!.part - 2 / 3) < 1e-9);
  assert.equal(q1.distracteurs.find((d) => d.libelle === "3")!.correct, true);

  const ana = r.eleves.find((e) => e.prenom === "Ana")!;
  assert.equal(ana.statut, "corrigee");
  assert.equal(ana.note, 20);
  assert.equal(r.eleves.find((e) => e.prenom === "Bea")!.statut, "a_corriger", "la rédigée reste à corriger");
  assert.equal(r.eleves.find((e) => e.prenom === "Dan")!.statut, "absent");
  assert.equal(r.rendues, 3);
  assert.equal(r.aCorrigerTotal, 2);
  assert.equal(r.aReprendre[0]!.notion, "Images", "la notion la moins réussie d'abord");

  const csv = exportNotes(r.eleves, "les_deux").split("\r\n");
  assert.equal(csv[0], "Nom;Prénom;Note sur 20;Maîtrise");
  assert.ok(csv.includes("Dan;Dan;Abs;Abs"));
  assert.ok(csv.includes("Ana;Ana;20;Très bonne maîtrise"));
});
