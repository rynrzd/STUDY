import assert from "node:assert/strict";
import test from "node:test";
import {
  classer,
  distance,
  normaliserRequete,
  paginer,
  suggerer,
  surligner,
  termes,
  type Candidat,
} from "../../src/lib/recherche/moteur.ts";

/**
 * La mise en forme des résultats — dossier Study V6, §7.3.
 * Les candidats arrivent déjà autorisés ; on vérifie ici qu'aucune étape ne
 * réécrit le texte, n'invente un lien, ni ne mélange les pages.
 */

const candidat = (id: string, source: string, rang: number, extra: Partial<Candidat> = {}): Candidat => ({
  doc_id: id,
  kind: "seance",
  source_id: source,
  passage_ref: `bloc:${id}`,
  page: null,
  section: null,
  titre: `Séance ${source}`,
  extrait: "On dit que a est un antécédent de b par la fonction f.",
  validation: "professeur",
  date_source: "2026-10-01T08:00:00Z",
  rang,
  teaching_space_id: "E1",
  class_id: "C1",
  salon_id: null,
  project_id: null,
  ...extra,
});

test("normalisation : espaces reduits, 500 caracteres au plus", () => {
  assert.equal(normaliserRequete("  image   et  antécédent "), "image et antécédent");
  assert.equal(normaliserRequete("x".repeat(900)).length, 500);
  assert.deepEqual(termes("Les antécédents d'une image"), ["antecedents", "une", "image"].filter((t) => t !== "une"));
});

test("surlignage : insensible aux accents, fidele au texte, sans HTML", () => {
  const segments = surligner("Un <b>antécédent</b> de b par f.", ["antecedent"]);
  const texte = segments.map((s) => s.texte).join("");
  assert.equal(texte, "Un <b>antécédent</b> de b par f.", "le texte n'est ni reecrit ni interprete");
  assert.ok(segments.some((s) => s.marque && s.texte.includes("antécédent")));
  const long = `${"mot ".repeat(200)}antécédent ${"fin ".repeat(200)}`;
  const coupe = surligner(long, ["antecedent"]);
  assert.equal(coupe[0]!.texte, "… ");
  assert.ok(coupe.some((s) => s.marque));
});

test("classement : deux passages au plus par ressource, depart stable", () => {
  const lexical = [candidat("d1", "S1", 3), candidat("d2", "S1", 2), candidat("d3", "S1", 1), candidat("d4", "S2", 1)];
  const r = classer(lexical, [], "antécédent");
  assert.equal(r.length, 2);
  assert.equal(r[0]!.id, "S1");
  assert.equal(r[0]!.passages.length, 2);
  assert.equal(r[0]!.href, "/app/seances/S1#bloc-d1");

  // A score egal, le contenu valide par le professeur passe avant celui d'un eleve.
  const egal = classer(
    [candidat("m", "M1", 1, { kind: "message", validation: "eleve", salon_id: "SA", class_id: "C1" })],
    [candidat("s", "S9", 1)],
    "x",
  );
  assert.equal(egal[0]!.kind, "message", "rang 1 lexical l'emporte sur rang 1 semantique (0,55 > 0,45)");
});

test("pagination par curseur lie a la requete et au perimetre", () => {
  const nombreux = Array.from({ length: 45 }, (_, i) => candidat(`d${i}`, `S${String(i).padStart(2, "0")}`, 45 - i));
  const tous = classer(nombreux, [], "antécédent");
  const p1 = paginer(tous, "q", "toutes|", null);
  assert.equal(p1.items.length, 20);
  assert.ok(p1.suivant);
  const p2 = paginer(tous, "q", "toutes|", p1.suivant);
  assert.equal(p2.items[0]!.id, tous[20]!.id);
  const autre = paginer(tous, "autre requete", "toutes|", p1.suivant);
  assert.equal(autre.items[0]!.id, tous[0]!.id, "un curseur d'une autre requete est ignore");
  const p3 = paginer(tous, "q", "toutes|", paginer(tous, "q", "toutes|", p2.suivant).suivant ?? p2.suivant);
  assert.ok(p3.items.length > 0);
});

test("tolerance aux fautes : seulement depuis le vocabulaire visible", () => {
  assert.equal(distance("antecedant", "antecedent"), 1);
  assert.equal(suggerer("antécédant", ["antecedent", "image"]), "antecedent");
  assert.equal(suggerer("antécédant", ["image"]), null, "rien a proposer hors du visible");
  assert.equal(suggerer("image", ["image"]), null);
});
