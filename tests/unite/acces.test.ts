import assert from "node:assert/strict";
import test from "node:test";
import { cellule, csvAcces, type LigneAcces } from "../../src/lib/acces.ts";

/**
 * Export des accès — cahier V5, §7.2.
 *
 * Deux exigences se croisent ici. Le fichier doit s'ouvrir correctement dans
 * le tableur d'un secrétariat français, et il ne doit contenir ni secret ni
 * formule exécutable. Le premier point est une question de confort ; le
 * second est une vulnérabilité réelle, exploitée pour exfiltrer des tableurs
 * entiers depuis un poste de bureau.
 */

const ligne = (partiel: Partial<LigneAcces>): LigneAcces => ({
  profileId: "00000000-0000-4000-8000-000000000001",
  prenom: "Martin",
  nom: "Dupont",
  login: "martin.dupont",
  classe: "2nde 4",
  role: "eleve",
  etat: "actif",
  ...partiel,
});

test("§7.2 — le fichier s ouvre dans un tableur francais", () => {
  const csv = csvAcces([ligne({ prenom: "Émilie" })]);

  assert.ok(csv.startsWith("﻿"), "le BOM evite « Ã‰milie » a l ouverture");
  assert.ok(csv.includes('"Émilie"'), "l accent est conserve tel quel");
  assert.ok(
    csv.split("\r\n")[0]?.includes(";"),
    "le point-virgule separe : Excel en francais lit la virgule comme un decimal",
  );
  assert.ok(csv.endsWith("\r\n"), "le fichier se termine par une fin de ligne");
});

test("§7.2 — aucun mot de passe ne sort par l export", () => {
  const csv = csvAcces([ligne({})]);
  const entetes = csv.split("\r\n")[0] ?? "";

  assert.equal(
    /mot de passe|password|secret|mdp/i.test(entetes),
    false,
    "il n y a pas de colonne de secret, et il ne peut pas y en avoir",
  );
  assert.ok(entetes.includes("Identifiant"));
  assert.ok(entetes.includes("État du compte"));
});

test("§7.2 — une valeur qui ressemble a une formule est desamorcee", () => {
  // Un nom qui commence par « = » est execute a l ouverture du fichier. Le cas
  // n est pas theorique : c est ainsi qu on fait sortir un tableur entier.
  assert.equal(cellule("=1+1"), "\"'=1+1\"");
  assert.equal(cellule("+33612345678"), "\"'+33612345678\"");
  assert.equal(cellule("-2"), "\"'-2\"");
  assert.equal(cellule("@import"), "\"'@import\"");

  // Un nom ordinaire n est pas touche.
  assert.equal(cellule("Dupont"), '"Dupont"');
  assert.equal(cellule("O'Brien"), "\"O'Brien\"");
});

test("§7.2 — un guillemet dans un nom ne casse pas la colonne suivante", () => {
  const csv = csvAcces([ligne({ nom: 'Du"pont' })]);

  assert.ok(csv.includes('"Du""pont"'), "le guillemet est double, comme le veut le format");
  assert.equal(csv.split("\r\n").length, 3, "il reste une ligne d en-tete et une de donnees");
});

test("§7.2 — une classe absente ne trahit pas la structure", () => {
  const csv = csvAcces([ligne({ classe: null, role: "professeur", etat: "a_activer" })]);
  const donnees = csv.split("\r\n")[1] ?? "";

  assert.ok(donnees.includes('""'), "la classe vide reste une cellule vide");
  assert.ok(donnees.includes('"Professeur"'));
  assert.ok(donnees.includes('"Jamais connecté"'), "l etat est traduit pour un humain");
});
