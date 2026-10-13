import assert from "node:assert/strict";
import test from "node:test";
import { analyserTexteRiche } from "../../src/lib/texte-riche.ts";

/** EDIT-01 — titres, listes, encadrés, tableaux dans un bloc texte. */

test("TR-01 — chaque convention donne sa structure", () => {
  const b = analyserTexteRiche(["# Le cours", "Un paragraphe", "sur deux lignes.", "", "- un", "- deux", "1. étape", "2. suite", "> À retenir", "## Exemple"].join("\n"));
  assert.deepEqual(b.map((x) => x.type), ["titre", "paragraphe", "liste", "liste", "encadre", "titre"]);
  assert.deepEqual(b[2], { type: "liste", numerotee: false, elements: ["un", "deux"] });
  assert.deepEqual(b[3], { type: "liste", numerotee: true, elements: ["étape", "suite"] });
  assert.equal((b[1] as { texte: string }).texte, "Un paragraphe\nsur deux lignes.");
});

test("TR-02 — un tableau : en-tête, séparateur ignoré, cellules nettoyées", () => {
  const b = analyserTexteRiche("| x | f(x) |\n|---|---|\n| 1 | $x^2$ |\n| 2 | 4 |");
  assert.deepEqual(b, [{ type: "tableau", entete: ["x", "f(x)"], lignes: [["1", "$x^2$"], ["2", "4"]] }]);
});

test("TR-03 — sans convention, le texte reste un paragraphe ; aucune balise n'est interprétée", () => {
  assert.deepEqual(analyserTexteRiche("Simple texte <script>x</script>"), [{ type: "paragraphe", texte: "Simple texte <script>x</script>" }]);
  assert.deepEqual(analyserTexteRiche("-pas une puce"), [{ type: "paragraphe", texte: "-pas une puce" }]);
});
