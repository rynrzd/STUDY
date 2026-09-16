import assert from "node:assert/strict";
import test from "node:test";
import {
  DELAI_MINIMUM_MS,
  empreinteDeduplication,
  genererReference,
  jetonOuverture,
  schemaDemande,
  verifierOuverture,
} from "../../src/lib/demande-commerciale.ts";

/**
 * Demande de démonstration ou de devis (finition V1, §5.2).
 *
 * Ce qui est vérifié ici tient en trois questions : la référence est-elle
 * lisible et non devinable, l'anti-spam laisse-t-il passer une personne
 * normale, et une même demande envoyée deux fois donne-t-elle bien la même
 * empreinte ?
 */

const SECRET = Buffer.alloc(32, 7).toString("base64");

function aleatoire(octets: number): Uint8Array {
  return new Uint8Array(Array.from({ length: octets }, (_, index) => index * 37));
}

test("la reference est lisible, datee, et sans caractere ambigu", () => {
  const reference = genererReference(aleatoire, new Date("2026-09-15T10:00:00Z"));

  assert.match(reference, /^AS-2609-[A-Z2-9]{5}$/);
  // Ni O ni 0, ni I ni 1 : elle est dictee au telephone.
  assert.ok(!/[O0I1]/.test(reference.slice(8)));
});

test("la reference ne revele pas combien de demandes ont ete recues", () => {
  const premiere = genererReference(() => new Uint8Array([1, 2, 3, 4, 5]));
  const seconde = genererReference(() => new Uint8Array([9, 8, 7, 6, 5]));

  assert.notEqual(premiere, seconde);
  // Aucun compteur : deux appels successifs ne se suivent pas.
  assert.ok(!/\d{4,}$/.test(premiere));
});

test("le jeton d ouverture refuse un envoi instantane, accepte un envoi humain", () => {
  const ouvertLe = 1_700_000_000_000;
  const jeton = jetonOuverture(SECRET, ouvertLe);

  assert.equal(verifierOuverture(jeton, SECRET, ouvertLe + 500), "trop_rapide");
  assert.equal(verifierOuverture(jeton, SECRET, ouvertLe + DELAI_MINIMUM_MS + 1), "valide");
  assert.equal(verifierOuverture(jeton, SECRET, ouvertLe + 3 * 60 * 60 * 1000), "perime");
});

test("un jeton d ouverture falsifie est refuse", () => {
  const jeton = jetonOuverture(SECRET, 1_700_000_000_000);
  const [horodatage] = jeton.split(".");

  // Rejouer un horodatage plus recent avec l ancienne signature.
  const falsifie = `${Number(horodatage) + 10_000}.${jeton.split(".")[1]}`;
  assert.equal(verifierOuverture(falsifie, SECRET, 1_700_000_100_000), "invalide");

  // Signature d un autre secret.
  const autre = jetonOuverture(Buffer.alloc(32, 9).toString("base64"), 1_700_000_000_000);
  assert.equal(verifierOuverture(autre, SECRET, 1_700_000_010_000), "invalide");
});

test("l empreinte de deduplication ignore la casse et les espaces", () => {
  const a = empreinteDeduplication({
    etablissement: "Lycée Jean Moulin",
    contactEmail: "Direction@Lycee.fr",
  });
  const b = empreinteDeduplication({
    etablissement: "  lycée jean moulin  ",
    contactEmail: "direction@lycee.fr",
  });

  assert.equal(a, b);
  // Hachee : l adresse ne se lit pas dans l index.
  assert.match(a, /^[0-9a-f]{64}$/);
  assert.ok(!a.includes("lycee"));
});

test("l empreinte ne depend pas du texte du besoin", () => {
  const base = { etablissement: "Lycée A", contactEmail: "a@b.fr" };
  assert.equal(empreinteDeduplication(base), empreinteDeduplication({ ...base }));
});

test("la validation exige le consentement et un besoin decrit", () => {
  const complet = {
    etablissement: "Lycée Jean Moulin",
    type: "public",
    commune: "Roubaix",
    contactNom: "Claude Martin",
    contactFonction: "Proviseur",
    contactEmail: "direction@lycee.fr",
    contactTelephone: "",
    effectif: "900",
    besoin: "Nous cherchons a organiser les devoirs de seconde.",
    consentement: "oui",
  };

  assert.equal(schemaDemande.safeParse(complet).success, true);

  assert.equal(
    schemaDemande.safeParse({ ...complet, consentement: undefined }).success,
    false,
    "sans consentement, la demande ne doit pas etre acceptee",
  );

  assert.equal(
    schemaDemande.safeParse({ ...complet, besoin: "trop peu" }).success,
    false,
  );

  assert.equal(
    schemaDemande.safeParse({ ...complet, contactEmail: "pas-une-adresse" }).success,
    false,
  );
});

test("le telephone est facultatif mais controle quand il est saisi", () => {
  const base = {
    etablissement: "Lycée A",
    type: "prive",
    commune: "Lille",
    contactNom: "C. M.",
    contactFonction: "Directeur",
    contactEmail: "a@b.fr",
    besoin: "Une question sur le fonctionnement.",
    consentement: "oui",
  };

  assert.equal(schemaDemande.safeParse({ ...base, contactTelephone: "" }).success, true);
  assert.equal(
    schemaDemande.safeParse({ ...base, contactTelephone: "+33 3 20 00 00 00" }).success,
    true,
  );
  assert.equal(
    schemaDemande.safeParse({ ...base, contactTelephone: "appelez-moi" }).success,
    false,
  );
});
