import { aplatir } from "./assistant-rentree.ts";
import type { Tableau } from "./tableur.ts";

/**
 * Import de groupes — lecture du fichier (cahier des charges ch. 17, IMP-05).
 *
 * Deux formes sont acceptées, sans rien deviner de plus :
 *
 *  - une ligne par appartenance : `groupe ; eleve` (+ `type`, `matiere`,
 *    `professeur` facultatifs) ;
 *  - la forme du cahier, une ligne par élève avec ses groupes dans une seule
 *    cellule : `external_id ; … ; groupes` où `groupes` vaut
 *    « Spé Maths A|Anglais B ». Chaque groupe devient une ligne.
 *
 * Ce module ne touche pas la base : le rapprochement avec les comptes se fait
 * en base (`etab_import_groupes`), qui seule connaît les identifiants.
 */

export interface LigneGroupe {
  readonly groupe: string;
  readonly type?: string;
  readonly eleve?: string;
  readonly matiere?: string;
  readonly professeur?: string;
}

type Champ = "groupe" | "groupes" | "type" | "eleve" | "matiere" | "professeur";

const INTITULES: Record<Champ, readonly string[]> = {
  groupe: ["groupe", "nom du groupe", "groupe pedagogique", "option", "specialite", "enseignement de specialite"],
  groupes: ["groupes", "options", "specialites"],
  type: ["type", "type de groupe"],
  eleve: ["eleve", "identifiant", "identifiant eleve", "identifiant externe", "external id", "ine", "login", "matricule"],
  matiere: ["matiere", "discipline"],
  professeur: ["professeur", "enseignant", "identifiant professeur", "prof", "teacher external id"],
};

export const LIGNES_MAX_GROUPES = 3000;

export function lireGroupes(tableau: Tableau): { lignes: LigneGroupe[]; erreur: string | null; colonnes: Partial<Record<Champ, string>> } {
  const index: Partial<Record<Champ, number>> = {};
  tableau.entetes.forEach((entete, i) => {
    const plat = aplatir(entete);
    for (const champ of Object.keys(INTITULES) as Champ[]) {
      if (index[champ] === undefined && INTITULES[champ].includes(plat)) {
        index[champ] = i;
        return;
      }
    }
  });
  const colonnes = Object.fromEntries(Object.entries(index).map(([c, i]) => [c, tableau.entetes[i as number]])) as Partial<Record<Champ, string>>;

  if (index.groupe === undefined && index.groupes === undefined) {
    return { lignes: [], erreur: "Aucune colonne « groupe » ou « groupes » n'a été trouvée.", colonnes };
  }
  const cellule = (ligne: readonly string[], champ: Champ) => (index[champ] === undefined ? "" : (ligne[index[champ]!] ?? "").trim());

  const lignes: LigneGroupe[] = [];
  for (const brute of tableau.lignes) {
    if (brute.every((c) => (c ?? "").trim() === "")) continue;
    const commun = {
      type: cellule(brute, "type") || undefined,
      eleve: cellule(brute, "eleve") || undefined,
      matiere: cellule(brute, "matiere") || undefined,
      professeur: cellule(brute, "professeur") || undefined,
    };
    const noms =
      index.groupe !== undefined
        ? [cellule(brute, "groupe")]
        : cellule(brute, "groupes")
            .split(/[|,]/)
            .map((g) => g.trim())
            .filter((g) => g !== "");
    // Une ligne sans groupe est transmise telle quelle : la base la rejette
    // avec son numéro, au lieu de la faire disparaître (IMP-08).
    for (const groupe of noms.length === 0 ? [""] : noms) lignes.push({ groupe, ...commun });
  }

  if (lignes.length > LIGNES_MAX_GROUPES) {
    return { lignes: [], erreur: `Le fichier dépasse ${LIGNES_MAX_GROUPES} lignes : découpez-le en plusieurs fichiers.`, colonnes };
  }
  return { lignes, erreur: null, colonnes };
}
