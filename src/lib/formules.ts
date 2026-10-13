/**
 * Découpage d'un texte de séance en morceaux de texte et formules LaTeX
 * (cahier des charges ch. 11, EDIT-04). Pur et testable : le rendu est fait
 * par `TexteAvecFormules`.
 *
 * `$$…$$` : formule centrée. `$…$` : formule dans la ligne, à condition que le
 * `$` ouvrant soit suivi d'un non-blanc et le fermant précédé d'un non-blanc
 * et non suivi d'un chiffre — « 5 $ et 10 $ » reste du texte. `\$` est un
 * dollar littéral.
 */
const MOTIF = /(\$\$[\s\S]+?\$\$|(?<!\\)\$(?=\S)[^$\n]+?(?<=\S)\$(?!\d))/g;

export type Morceau = { readonly type: "texte"; readonly valeur: string } | { readonly type: "formule"; readonly tex: string; readonly bloc: boolean; readonly source: string };

export function decouperFormules(texte: string): Morceau[] {
  if (!texte.includes("$")) return [{ type: "texte", valeur: texte }];
  return texte
    .split(MOTIF)
    .map((m, i): Morceau =>
      i % 2 === 0
        ? { type: "texte", valeur: m.replaceAll("\\$", "$") }
        : m.startsWith("$$")
          ? { type: "formule", tex: m.slice(2, -2), bloc: true, source: m }
          : { type: "formule", tex: m.slice(1, -1), bloc: false, source: m },
    )
    .filter((m) => m.type === "formule" || m.valeur !== "");
}
