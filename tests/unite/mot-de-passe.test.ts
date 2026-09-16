import assert from "node:assert/strict";
import test from "node:test";
import {
  controlerMotDePasse,
  LONGUEUR_MINIMALE,
  MESSAGES_MOT_DE_PASSE,
} from "../../src/lib/mot-de-passe.ts";

/**
 * Politique de mot de passe (finition V1, §5.1 — changement obligatoire du mot
 * de passe temporaire).
 *
 * Le parti pris se vérifie ici : une phrase longue et simple passe, une suite
 * courte et « compliquée » ne passe pas. C'est l'inverse de ce que produisent
 * les règles de composition classiques.
 */

test("une phrase de passe longue est acceptee", () => {
  const resultat = controlerMotDePasse({
    nouveau: "le chat dort sur le radiateur",
    confirmation: "le chat dort sur le radiateur",
  });

  assert.equal(resultat.accepte, true);
});

test("un mot de passe court est refuse, meme avec chiffres et symboles", () => {
  const resultat = controlerMotDePasse({ nouveau: "Ab3$xY!2", confirmation: "Ab3$xY!2" });

  assert.equal(resultat.accepte, false);
  assert.equal(resultat.motif, "trop_court");
  assert.match(MESSAGES_MOT_DE_PASSE.trop_court, new RegExp(String(LONGUEUR_MINIMALE)));
});

test("une repetition d un seul caractere ne passe pas la longueur minimale", () => {
  const resultat = controlerMotDePasse({
    nouveau: "aaaaaaaaaaaaaaaa",
    confirmation: "aaaaaaaaaaaaaaaa",
  });

  assert.equal(resultat.accepte, false);
  assert.equal(resultat.motif, "trop_repetitif");
});

test("une suite trop connue est refusee meme si elle est longue", () => {
  for (const suite of ["azertyuiopqsdfg", "monmotdepasse2026", "avecstudy2026!!"]) {
    const resultat = controlerMotDePasse({ nouveau: suite, confirmation: suite });
    assert.equal(resultat.accepte, false, `« ${suite} » aurait du etre refuse`);
    assert.equal(resultat.motif, "trop_commun");
  }
});

test("les deux saisies doivent correspondre", () => {
  const resultat = controlerMotDePasse({
    nouveau: "le chat dort sur le radiateur",
    confirmation: "le chat dort sur le radiateurs",
  });

  assert.equal(resultat.accepte, false);
  assert.equal(resultat.motif, "confirmation_differente");
});

test("le mot de passe temporaire ne peut pas etre reconduit", () => {
  const temporaire = "Kd7ntPqVbXr2Wm4y";
  const resultat = controlerMotDePasse({
    nouveau: temporaire,
    confirmation: temporaire,
    ancien: temporaire,
  });

  assert.equal(resultat.accepte, false);
  assert.equal(resultat.motif, "identique_au_temporaire");
});

test("chaque motif de refus a un message exploitable par un eleve", () => {
  for (const [motif, message] of Object.entries(MESSAGES_MOT_DE_PASSE)) {
    assert.ok(message.length > 20, `message trop court pour « ${motif} »`);
    // Pas de jargon : un message qui parle d entropie n aide personne.
    assert.ok(!/entropie|hash|bits/i.test(message), `jargon dans « ${motif} »`);
  }
});
