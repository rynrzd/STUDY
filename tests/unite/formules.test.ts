import assert from "node:assert/strict";
import test from "node:test";
import { decouperFormules } from "../../src/lib/formules.ts";
import { formuleEnArbre, lireMathml, type Noeud } from "../../src/lib/mathml.ts";

/** EDIT-04 — formules : le texte reste du LaTeX, l'affichage le rend en MathML, sans HTML brut. */

const texteDe = (n: Noeud | string): string => (typeof n === "string" ? n : n.balise === "annotation" ? "" : n.enfants.map(texteDe).join(""));

test("FOR-01 — formule dans la ligne et formule centrée", () => {
  const m = decouperFormules("Soit $f(x) = x^2$ et $$\\frac{a}{b}$$ fin.");
  assert.deepEqual(
    m.map((x) => (x.type === "texte" ? ["t", x.valeur] : ["f", x.tex, x.bloc])),
    [["t", "Soit "], ["f", "f(x) = x^2", false], ["t", " et "], ["f", "\\frac{a}{b}", true], ["t", " fin."]],
  );
});

test("FOR-02 — un prix n'est pas une formule ; \\$ est un dollar", () => {
  assert.deepEqual(decouperFormules("Le livre coûte 5 $ et le cahier 10 $."), [{ type: "texte", valeur: "Le livre coûte 5 $ et le cahier 10 $." }]);
  assert.deepEqual(decouperFormules("Entre $5 et $10"), [{ type: "texte", valeur: "Entre $5 et $10" }]);
  assert.deepEqual(decouperFormules("un \\$ seul"), [{ type: "texte", valeur: "un $ seul" }]);
});

test("FOR-03 — les formules courantes du lycée passent la liste fermée", () => {
  for (const tex of [
    "x_{1,2} = \\frac{-b \\pm \\sqrt{\\Delta}}{2a}",
    "\\begin{pmatrix}1&2\\\\3&4\\end{pmatrix}",
    "\\overrightarrow{AB} \\in \\mathbb{R}",
    "\\sum_{i=1}^{n} i^2 \\int_0^1 f(x)\\,dx \\lim_{x \\to 0}",
    "\\text{si } x<0",
    "\\color{red}{x}",
  ]) {
    const arbre = formuleEnArbre(tex, true);
    assert.ok(arbre !== null, tex);
    assert.equal(arbre.balise, "math");
  }
  assert.equal(texteDe(formuleEnArbre("x<y", false)!), "x<y", "les entités sont décodées en texte, pas en balises");
});

test("FOR-04 — une formule fausse ou une balise hors liste : rien n'est rendu (affichée telle qu'écrite)", () => {
  assert.equal(formuleEnArbre("\\frac{a}{", false), null);
  assert.equal(formuleEnArbre("\\href{javascript:alert(1)}{x}", false)?.balise ?? null, "math", "trust: false : la commande reste du texte");
  assert.ok(!JSON.stringify(formuleEnArbre("\\href{javascript:alert(1)}{x}", false)).includes('"href"'));
  assert.throws(() => lireMathml('<math><mi onclick="x">a</mi></math>'), /attribut refusé/);
  assert.throws(() => lireMathml("<math><script>alert(1)</script></math>"), /balise refusée/);
  assert.throws(() => lireMathml('<math><mi mathcolor="url(javascript:x)">a</mi></math>'), /attribut refusé/);
  assert.throws(() => lireMathml("<math><mi>a</mo></math>"), /imbriquées/);
});
