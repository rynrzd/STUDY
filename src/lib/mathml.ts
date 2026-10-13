import katex from "katex";

/**
 * Formules sans HTML brut — cahier des charges ch. 11 (EDIT-04).
 *
 * Le produit n'injecte jamais de HTML brut (règle vérifiée par
 * tests/unite/extraction.test.ts). KaTeX rend donc la formule en MathML — le
 * format de formules que les navigateurs affichent eux-mêmes et que les
 * lecteurs d'écran lisent — et ce MathML est relu ici par un lecteur strict :
 * seules les balises et attributs MathML d'une liste fermée passent, avec des
 * valeurs simples. Tout le reste fait échouer la lecture, et la formule est
 * alors montrée telle qu'écrite. Le résultat est un arbre de données, que le
 * composant transforme en éléments React.
 */

export type Noeud = { readonly balise: string; readonly attributs: Readonly<Record<string, string>>; readonly enfants: readonly (Noeud | string)[] };

const BALISES = new Set([
  "math", "semantics", "annotation", "mrow", "mi", "mn", "mo", "ms", "mtext", "mspace", "mfrac", "msqrt", "mroot",
  "msub", "msup", "msubsup", "munder", "mover", "munderover", "mtable", "mtr", "mtd", "mstyle", "mpadded", "mphantom", "menclose",
]);
const ATTRIBUTS = new Set([
  "display", "mathvariant", "fence", "separator", "stretchy", "accent", "accentunder", "displaystyle", "scriptlevel", "mathcolor",
  "columnalign", "columnspacing", "rowspacing", "columnlines", "rowlines", "width", "height", "depth", "lspace", "rspace", "minsize",
  "maxsize", "movablelimits", "linethickness", "notation", "encoding", "symmetric", "largeop", "mathsize", "voffset", "form",
]);
/** Des mots, des nombres, des unités, une couleur : ni guillemet, ni parenthèse, ni deux-points d'URL. */
const VALEUR = /^[\w#.%\s/-]{0,80}$/;
const JETON = /<(\/?)([a-zA-Z]+)((?:\s+[a-zA-Z:-]+="[^"]*")*)\s*(\/?)>|([^<]+)/gy;

function decoder(texte: string): string {
  return texte.replace(/&(lt|gt|amp|quot|#39|#x[0-9a-fA-F]+|#\d+);/g, (_, e: string) =>
    e === "lt" ? "<" : e === "gt" ? ">" : e === "amp" ? "&" : e === "quot" ? '"' : e === "#39" ? "'" : String.fromCodePoint(e.startsWith("#x") ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10)),
  );
}

/** Lit le MathML produit par KaTeX ; lève une erreur au moindre élément hors liste. */
export function lireMathml(source: string): Noeud {
  const racine: { balise: string; attributs: Record<string, string>; enfants: (Noeud | string)[] } = { balise: "#", attributs: {}, enfants: [] };
  const pile = [racine];
  JETON.lastIndex = 0;
  let m: RegExpExecArray | null;
  let lu = 0;
  while (lu < source.length && (m = JETON.exec(source)) !== null) {
    lu = JETON.lastIndex;
    const [, fermante, balise, attributsBruts, autoFermante, texte] = m;
    const courant = pile[pile.length - 1]!;
    if (texte !== undefined) {
      courant.enfants.push(decoder(texte));
      continue;
    }
    // L'enveloppe <span class="katex"> est retirée : seule la formule compte.
    if (balise === "span") continue;
    if (!BALISES.has(balise!)) throw new Error(`balise refusée : ${balise}`);
    if (fermante) {
      if (courant.balise !== balise || pile.length === 1) throw new Error("balises mal imbriquées");
      pile.pop();
      continue;
    }
    const attributs: Record<string, string> = {};
    for (const a of attributsBruts!.matchAll(/([a-zA-Z:-]+)="([^"]*)"/g)) {
      const [, nom, valeur] = a;
      if (nom === "xmlns") continue;
      const v = decoder(valeur!);
      if (!ATTRIBUTS.has(nom!) || !VALEUR.test(v)) throw new Error(`attribut refusé : ${nom}`);
      attributs[nom!] = v;
    }
    const noeud = { balise: balise!, attributs, enfants: [] as (Noeud | string)[] };
    courant.enfants.push(noeud);
    if (!autoFermante) pile.push(noeud);
  }
  if (lu !== source.length || pile.length !== 1) throw new Error("MathML incomplet");
  const math = racine.enfants.find((e): e is Noeud => typeof e !== "string" && e.balise === "math");
  if (math === undefined) throw new Error("aucune formule");
  return math;
}

/** LaTeX → arbre MathML sûr ; `null` si la formule est fausse ou sort de la liste. */
export function formuleEnArbre(tex: string, bloc: boolean): Noeud | null {
  try {
    const mathml = katex.renderToString(tex, { output: "mathml", displayMode: bloc, throwOnError: true, trust: false, strict: "ignore", maxSize: 20, maxExpand: 200 });
    return lireMathml(mathml);
  } catch {
    return null;
  }
}
