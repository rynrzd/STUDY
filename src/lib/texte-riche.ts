/**
 * Mise en forme d'un bloc texte de séance — cahier des charges ch. 11
 * (EDIT-01). Le texte reste tel que le professeur l'a écrit ; à l'affichage,
 * quelques conventions simples deviennent une structure :
 *
 *   # Titre            ## Sous-titre
 *   - puce             1. étape numérotée
 *   > encadré (à retenir, définition…)
 *   | a | b |          (lignes consécutives : un tableau ; la première est
 *   | 1 | 2 |           l'en-tête, une ligne « |---|---| » est ignorée)
 *
 * Tout le reste est un paragraphe ; une ligne vide sépare les paragraphes.
 * Aucune balise HTML n'est interprétée : un « < » reste un caractère.
 */

export type BlocRiche =
  | { readonly type: "titre"; readonly niveau: 2 | 3; readonly texte: string }
  | { readonly type: "paragraphe"; readonly texte: string }
  | { readonly type: "liste"; readonly numerotee: boolean; readonly elements: readonly string[] }
  | { readonly type: "encadre"; readonly texte: string }
  | { readonly type: "tableau"; readonly entete: readonly string[]; readonly lignes: readonly (readonly string[])[] };

const cellules = (ligne: string) =>
  ligne
    .trim()
    .replace(/^\|/, "")
    .replace(/\|$/, "")
    .split("|")
    .map((c) => c.trim());

export function analyserTexteRiche(texte: string): BlocRiche[] {
  const lignes = texte.replace(/\r\n?/g, "\n").split("\n");
  const blocs: BlocRiche[] = [];
  let paragraphe: string[] = [];
  const fermerParagraphe = () => {
    if (paragraphe.length > 0) blocs.push({ type: "paragraphe", texte: paragraphe.join("\n") });
    paragraphe = [];
  };

  for (let i = 0; i < lignes.length; i++) {
    const ligne = lignes[i]!;
    const nette = ligne.trim();

    if (nette === "") {
      fermerParagraphe();
      continue;
    }
    const titre = /^(#{1,2})\s+(.+)$/.exec(nette);
    if (titre) {
      fermerParagraphe();
      blocs.push({ type: "titre", niveau: titre[1]!.length === 1 ? 2 : 3, texte: titre[2]! });
      continue;
    }
    if (/^[-*•]\s+/.test(nette) || /^\d+[.)]\s+/.test(nette)) {
      fermerParagraphe();
      const numerotee = /^\d+[.)]\s+/.test(nette);
      const elements: string[] = [];
      while (i < lignes.length && (numerotee ? /^\d+[.)]\s+/ : /^[-*•]\s+/).test(lignes[i]!.trim())) {
        elements.push(lignes[i]!.trim().replace(numerotee ? /^\d+[.)]\s+/ : /^[-*•]\s+/, ""));
        i++;
      }
      i--;
      blocs.push({ type: "liste", numerotee, elements });
      continue;
    }
    if (nette.startsWith(">")) {
      fermerParagraphe();
      const contenu: string[] = [];
      while (i < lignes.length && lignes[i]!.trim().startsWith(">")) {
        contenu.push(lignes[i]!.trim().replace(/^>\s?/, ""));
        i++;
      }
      i--;
      blocs.push({ type: "encadre", texte: contenu.join("\n") });
      continue;
    }
    if (nette.startsWith("|") && nette.endsWith("|") && nette.length > 2) {
      fermerParagraphe();
      const rangees: string[][] = [];
      while (i < lignes.length && /^\|.*\|$/.test(lignes[i]!.trim())) {
        const c = cellules(lignes[i]!);
        if (!c.every((x) => /^:?-{2,}:?$/.test(x))) rangees.push(c);
        i++;
      }
      i--;
      const [entete = [], ...corps] = rangees;
      blocs.push({ type: "tableau", entete, lignes: corps });
      continue;
    }
    paragraphe.push(ligne);
  }
  fermerParagraphe();
  return blocs;
}
