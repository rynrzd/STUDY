import assert from "node:assert/strict";
import test from "node:test";
import { IDENTITE, mentionsManquantes } from "../../src/lib/identite-legale.ts";

/**
 * Mentions légales — ce qui est publié, et ce qui ne l'est pas.
 *
 * Deux fautes symétriques sont possibles sur une page de mentions légales, et
 * les deux se paient. Publier un numéro inventé est une fausse déclaration.
 * Laisser en attente une mention qu'on possède est une négligence.
 *
 * Ces contrôles tiennent la frontière : ce qui est renseigné doit avoir la
 * forme de ce qu'il prétend être, et ce qui manque doit être annoncé comme
 * manquant plutôt que comblé.
 */

test("L01 — l hebergeur est nomme et situe", () => {
  // Relevé sur les pages légales de l'hébergeur, pas écrit de mémoire.
  assert.equal(IDENTITE.hebergeur.raisonSociale, "Vercel Inc.");
  assert.match(IDENTITE.hebergeur.adresse ?? "", /Covina/);
  assert.match(IDENTITE.hebergeur.adresse ?? "", /CA 91723/);
  assert.match(IDENTITE.hebergeur.adresse ?? "", /États-Unis$/);
});

test("L02 — aucun identifiant d entreprise n est invente", () => {
  // Un SIREN a neuf chiffres, un SIRET quatorze. Tant qu'ils ne sont pas
  // fournis, ils valent `null` — jamais une suite plausible, jamais un tiret
  // qu'un lecteur presse prendrait pour « sans objet ».
  for (const [nom, valeur, longueur] of [
    ["SIREN", IDENTITE.siren, 9],
    ["SIRET", IDENTITE.siret, 14],
  ] as const) {
    if (valeur === null) continue;
    assert.match(
      valeur.replace(/\s/g, ""),
      new RegExp(`^\\d{${longueur}}$`),
      `${nom} renseigne doit avoir ${longueur} chiffres`,
    );
  }

  if (IDENTITE.tvaIntracommunautaire !== null) {
    assert.match(
      IDENTITE.tvaIntracommunautaire.replace(/\s/g, ""),
      /^FR\d{2}\d{9}$/,
      "un numero de TVA francais s ecrit FR + cle + SIREN",
    );
  }

  if (IDENTITE.contactEmail !== null) {
    assert.match(IDENTITE.contactEmail, /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/);
  }
});

test("L03 — ce qui manque est annonce comme manquant", () => {
  const manquantes = mentionsManquantes();

  // L'hébergeur vient d'être renseigné : il ne doit plus figurer dans la
  // liste. Si ce test tombe, c'est que la page annonce comme « en cours de
  // publication » quelque chose qui est publié.
  assert.equal(
    manquantes.some((m) => /hébergeur/i.test(m)),
    false,
    "l hebergeur est renseigne et ne doit plus etre annonce comme manquant",
  );

  // Et l'inverse : tout champ encore vide doit être dans la liste, pour que la
  // page le dise au lieu de laisser un blanc.
  for (const [nom, valeur] of [
    ["SIREN", IDENTITE.siren],
    ["SIRET", IDENTITE.siret],
    ["adresse professionnelle", IDENTITE.adresse],
    ["adresse de contact publique", IDENTITE.contactEmail],
  ] as const) {
    if (valeur === null) {
      assert.ok(
        manquantes.includes(nom),
        `« ${nom} » est vide : la page doit l annoncer`,
      );
    }
  }
});

test("L04 — l editeur et le directeur de publication sont nommes", () => {
  // Ce sont les deux seules mentions qu'on ne peut pas différer : sans elles,
  // le service n'a pas d'auteur identifiable.
  assert.notEqual(IDENTITE.editeur.trim(), "");
  assert.notEqual(IDENTITE.directeurPublication.trim(), "");
  assert.notEqual(IDENTITE.nomCommercial.trim(), "");
});
