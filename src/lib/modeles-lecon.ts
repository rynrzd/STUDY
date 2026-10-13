/**
 * Modèles de leçon — cahier des charges ch. 11 (EDIT-13). Des modèles de
 * forme seulement : des intitulés à compléter, jamais de contenu inventé.
 * Chaque bloc est un bloc texte (titres « ## ») ou une consigne d'exercice
 * vide à remplir.
 */
export const MODELES_LECON = {
  vide: { libelle: "Séance vide", blocs: [] },
  cours: {
    libelle: "Cours complet",
    blocs: [
      { kind: "texte", contenu: { texte: "## Objectifs\n- " } },
      { kind: "texte", contenu: { texte: "## Le cours\n" } },
      { kind: "texte", contenu: { texte: "## Exemple\n" } },
      { kind: "texte", contenu: { texte: "> À retenir : " } },
      { kind: "exercice", contenu: { consigne: "Exercice d'application : " } },
    ],
  },
  revision: {
    libelle: "Fiche de révision",
    blocs: [
      { kind: "texte", contenu: { texte: "## L'essentiel\n- \n- \n- " } },
      { kind: "texte", contenu: { texte: "## Méthodes\n1. \n2. " } },
      { kind: "texte", contenu: { texte: "> Pièges à éviter : " } },
      { kind: "exercice", contenu: { consigne: "Pour vérifier : " } },
    ],
  },
  tp: {
    libelle: "Séance de TP",
    blocs: [
      { kind: "texte", contenu: { texte: "## But du TP\n" } },
      { kind: "texte", contenu: { texte: "## Matériel\n- " } },
      { kind: "texte", contenu: { texte: "## Protocole\n1. \n2. \n3. " } },
      { kind: "texte", contenu: { texte: "## Observations et résultats\n| Mesure | Valeur |\n|---|---|\n|  |  |" } },
      { kind: "texte", contenu: { texte: "## Conclusion\n" } },
    ],
  },
  exercices: {
    libelle: "Leçon avec exercices",
    blocs: [
      { kind: "texte", contenu: { texte: "## Rappel de cours\n" } },
      { kind: "exercice", contenu: { consigne: "Exercice 1 : " } },
      { kind: "exercice", contenu: { consigne: "Exercice 2 : " } },
      { kind: "exercice", contenu: { consigne: "Exercice 3 (pour aller plus loin) : " } },
    ],
  },
} as const;

export type ModeleLecon = keyof typeof MODELES_LECON;
