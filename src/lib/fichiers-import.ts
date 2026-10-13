/**
 * Fichiers de l'import — cahier des charges ch. 17 (IMP-14).
 *
 *  - un modèle minimal par type d'import, à remplir et redéposer ;
 *  - le fichier des lignes à corriger d'un lot : toutes, pas seulement les
 *    cinquante affichées, avec le motif de chacune, pour corriger dans le
 *    tableur puis ne redéposer que celles-là.
 *
 * Aucun secret de connexion n'y figure : ni mot de passe, ni identifiant
 * provisoire. Chaque cellule est désamorcée (une valeur commençant par `=`,
 * `+`, `-` ou `@` serait exécutée comme formule à l'ouverture).
 */

export function cellule(valeur: string): string {
  const desamorcee = /^[=+\-@\t\r]/.test(valeur) ? `'${valeur}` : valeur;
  return `"${desamorcee.replaceAll('"', '""')}"`;
}

/** UTF-8 avec BOM, séparateur « ; », fins de ligne CRLF : ce qu'Excel ouvre sans assistant. */
export function csv(entetes: readonly string[], lignes: readonly (readonly string[])[]): string {
  return `﻿${[entetes, ...lignes].map((l) => l.map(cellule).join(";")).join("\r\n")}\r\n`;
}

export const MODELES = {
  eleves: {
    nom: "modele-import-eleves.csv",
    contenu: csv(
      ["identifiant_externe", "prenom", "nom", "classe", "email"],
      [
        ["E123", "Lina", "Martin", "2nde 1", ""],
        ["E124", "Noah", "Bernard", "2nde 1", ""],
      ],
    ),
  },
  professeurs: {
    nom: "modele-import-professeurs.csv",
    contenu: csv(
      ["prenom", "nom", "email", "matieres", "classes"],
      [
        ["Claire", "Dupont", "", "Mathématiques", "2nde 1, 2nde 3"],
        ["Marc", "Durand", "", "Histoire-géographie", "1ere G2"],
      ],
    ),
  },
  groupes: {
    nom: "modele-import-groupes.csv",
    contenu: csv(
      ["groupe", "type", "eleve", "matiere", "professeur"],
      [
        ["Spé Maths A", "interclasses", "lina.martin", "Mathématiques", "claire.dupont"],
        ["Spé Maths A", "interclasses", "noah.bernard", "Mathématiques", "claire.dupont"],
        ["Anglais B", "interclasses", "lina.martin", "", ""],
      ],
    ),
  },
} as const;

export function csvErreursEleves(
  lignes: readonly { numero: number; fichier: string; prenom: string; nom: string; classe: string; identifiantExterne: string | null; etat: string; probleme: string | null }[],
): string {
  return csv(
    ["Ligne", "Fichier", "Prénom", "Nom", "Classe", "Identifiant externe", "À corriger"],
    lignes
      .filter((l) => l.etat === "a_corriger")
      .map((l) => [String(l.numero), l.fichier, l.prenom, l.nom, l.classe, l.identifiantExterne ?? "", l.probleme ?? "Ligne incomplète"]),
  );
}

export function csvErreursProfesseurs(
  lignes: readonly { numero: number; fichier: string; prenom: string; nom: string; email: string | null; affectations: readonly { matiere: string; classe: string }[]; valide: boolean; probleme: string | null }[],
): string {
  return csv(
    ["Ligne", "Fichier", "Prénom", "Nom", "E-mail", "Matières et classes", "À corriger"],
    lignes
      .filter((l) => !l.valide)
      .map((l) => [
        String(l.numero),
        l.fichier,
        l.prenom,
        l.nom,
        l.email ?? "",
        l.affectations.map((a) => `${a.matiere} : ${a.classe}`).join(" | "),
        l.probleme ?? "Ligne incomplète",
      ]),
  );
}
