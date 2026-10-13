import { nomsVoisins, plat } from "./noms-voisins.ts";

/**
 * Rapprocher une matière lue dans un fichier des matières déjà créées —
 * cahier des charges ch. 13 (IMP-17). La correspondance est transparente :
 * elle est affichée, et c'est l'administration qui choisit de l'utiliser.
 * Rien n'est remplacé en silence.
 *
 * Trois cas : la matière existe déjà (mêmes lettres aux accents et à la casse
 * près) ; elle ressemble à une matière existante (abréviation courante ou
 * faute de frappe) ; ou elle est nouvelle et sera créée telle quelle.
 */

/** Abréviations usuelles des emplois du temps, ramenées à une forme commune. */
const ALIAS: Record<string, string> = {
  math: "mathematiques",
  maths: "mathematiques",
  mathematique: "mathematiques",
  svt: "sciencesdelavieetdelaterre",
  ses: "sciencseconomiquesetsociales",
  sciencseconomiquesetsociales: "sciencseconomiquesetsociales",
  scienceseconomiquesetsociales: "sciencseconomiquesetsociales",
  hg: "histoiregeographie",
  histgeo: "histoiregeographie",
  histoiregeo: "histoiregeographie",
  hgemc: "histoiregeographie",
  histoiregeographieemc: "histoiregeographie",
  pc: "physiquechimie",
  physchimie: "physiquechimie",
  physiquechimique: "physiquechimie",
  sp: "physiquechimie",
  eps: "educationphysiqueetsportive",
  fr: "francais",
  philo: "philosophie",
  ang: "anglais",
  esp: "espagnol",
  all: "allemand",
  nsi: "numeriqueetsciencesinformatiques",
  snt: "sciencesnumeriquesettechnologie",
  emc: "enseignementmoraletcivique",
  techno: "technologie",
  ap: "accompagnementpersonnalise",
};

function canon(label: string): string {
  // « LV1 Anglais », « LVA anglais » : la langue, sans son rang.
  const p = plat(label).replace(/^(lv[12ab]|lva|lvb|lvc)/, "");
  return ALIAS[p] ?? p;
}

export type Suggestion =
  | { readonly etat: "reconnue"; readonly matiere: string; readonly existante: string }
  | { readonly etat: "suggestion"; readonly matiere: string; readonly existante: string }
  | { readonly etat: "nouvelle"; readonly matiere: string };

export function suggererMatiere(matiere: string, existantes: readonly string[]): Suggestion {
  const exacte = existantes.find((e) => plat(e) === plat(matiere));
  if (exacte !== undefined) return { etat: "reconnue", matiere, existante: exacte };
  const alias = existantes.find((e) => canon(e) === canon(matiere));
  if (alias !== undefined) return { etat: "suggestion", matiere, existante: alias };
  const voisine = existantes.find((e) => nomsVoisins(e, matiere));
  if (voisine !== undefined) return { etat: "suggestion", matiere, existante: voisine };
  return { etat: "nouvelle", matiere };
}

/** Une suggestion par matière distincte du fichier, dans l'ordre de lecture. */
export function suggererMatieres(lues: readonly string[], existantes: readonly string[]): Suggestion[] {
  const vues = new Set<string>();
  const sortie: Suggestion[] = [];
  for (const m of lues) {
    const cle = plat(m);
    if (cle === "" || vues.has(cle)) continue;
    vues.add(cle);
    sortie.push(suggererMatiere(m.trim(), existantes));
  }
  return sortie;
}
