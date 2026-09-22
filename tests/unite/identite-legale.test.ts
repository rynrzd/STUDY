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

test("L05 — le SIRET prolonge le SIREN, il ne le contredit pas", () => {
  // Un SIRET est le SIREN suivi du numéro d'établissement. Deux numéros qui
  // divergeraient décriraient deux entreprises — et AvecStudy n'en a qu'une.
  if (IDENTITE.siren === null || IDENTITE.siret === null) return;

  const siren = IDENTITE.siren.replace(/\s/g, "");
  const siret = IDENTITE.siret.replace(/\s/g, "");

  assert.equal(siret.slice(0, 9), siren, "le SIRET doit commencer par le SIREN");
  assert.equal(siret.length, 14);
});

test("L06 — la mention de TVA n est pas un numero de TVA", () => {
  // Deux choses différentes, et les confondre trompe un service comptable.
  // « TVA non applicable, article 293 B » dit qu'aucune TVA ne sera facturée ;
  // un numéro intracommunautaire dit l'inverse. L'entreprise est en franchise
  // en base : elle porte la mention, et n'a pas de numéro d'office.
  if (IDENTITE.regimeTva !== null) {
    assert.match(
      IDENTITE.regimeTva,
      /293\s?B/,
      "la mention de franchise cite l article 293 B du CGI",
    );
    assert.doesNotMatch(
      IDENTITE.regimeTva,
      /^FR\d/,
      "un numero de TVA ne s ecrit pas a la place de la mention de regime",
    );
  }

  // Et l'inverse : si un numéro est un jour attribué, il ne remplace pas la
  // mention — il s'y ajoute.
  if (IDENTITE.tvaIntracommunautaire !== null) {
    assert.notEqual(
      IDENTITE.regimeTva,
      null,
      "un numero de TVA n efface pas la mention de regime",
    );
  }
});

test("L07 — le code APE a la forme que l INSEE attribue", () => {
  if (IDENTITE.codeApe === null) return;
  assert.match(
    IDENTITE.codeApe,
    /^\d{2}\.\d{2}[A-Z]\b/,
    "un code APE s ecrit quatre chiffres, un point, une lettre",
  );
});

test("L08 — AvecStudy est un nom commercial, jamais une societe", () => {
  // La forme juridique décrit **l'entreprise**, pas le service. Écrire
  // « AvecStudy SAS » ou « AvecStudy SARL » inventerait une personne morale
  // qui n'existe pas, et déplacerait la responsabilité vers elle.
  assert.doesNotMatch(
    IDENTITE.nomCommercial,
    /\b(SAS|SARL|SASU|EURL|SA|SCOP)\b/i,
    "le nom commercial ne porte aucune forme sociale",
  );
  assert.match(
    IDENTITE.formeJuridique,
    /entrepreneur individuel/i,
    "l entreprise est une entreprise individuelle",
  );
});
