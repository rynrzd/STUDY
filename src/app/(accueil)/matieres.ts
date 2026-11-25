export interface Exercice {
  titre: string;
  motsCles: readonly string[];
  question: string;
  choix: readonly string[];
  bonneReponse: string;
  indice: string;
  explication: string;
  figure?: "triangle";
}

interface Matiere {
  titre: string;
  motsCles: readonly string[];
  exercices: readonly Exercice[];
}

export const matieres: readonly Matiere[] = [
  {
    titre: "Mathématiques",
    motsCles: ["math", "maths", "mathematiques"],
    exercices: [
      {
        titre: "Trigonométrie",
        motsCles: ["trigo", "trigonometrie", "cosinus", "sinus", "tangente", "triangle"],
        question: "Quel rapport relie le côté adjacent à l’hypoténuse ?",
        choix: ["Sinus", "Cosinus", "Tangente"],
        bonneReponse: "Cosinus",
        indice: "Regarde l’angle marqué. Le côté adjacent touche cet angle. L’hypoténuse est en face de l’angle droit.",
        explication: "Oui. Cosinus = côté adjacent ÷ hypoténuse.",
        figure: "triangle",
      },
      {
        titre: "Fonctions",
        motsCles: ["fonction", "fonctions", "affine", "affines"],
        question: "Si f(x) = 2x + 1, que vaut f(3) ?",
        choix: ["6", "7", "9"],
        bonneReponse: "7",
        indice: "Remplace x par 3, puis fais la multiplication avant l’addition.",
        explication: "Oui. f(3) = 2 × 3 + 1 = 7.",
      },
      {
        titre: "Probabilités",
        motsCles: ["proba", "probabilite", "probabilites", "hasard"],
        question: "Tu lances un dé équilibré à six faces. Quelle est la probabilité d’obtenir un nombre pair ?",
        choix: ["1/6", "1/3", "1/2"],
        bonneReponse: "1/2",
        indice: "Compte les nombres pairs parmi les six résultats possibles.",
        explication: "Oui. 2, 4 et 6 font trois résultats sur six, donc 3/6 = 1/2.",
      },
    ],
  },
  {
    titre: "Anglais",
    motsCles: ["anglais", "english"],
    exercices: [
      {
        titre: "L’ordre des mots",
        motsCles: ["ordre des mots", "phrase"],
        question: "Comment dit-on « Elle joue au tennis tous les dimanches » en anglais ?",
        choix: ["She tennis plays every Sunday.", "She plays tennis every Sunday.", "She every plays Sunday tennis."],
        bonneReponse: "She plays tennis every Sunday.",
        indice: "Commence par le sujet, puis le verbe et son complément.",
        explication: "Oui. She est le sujet, plays le verbe et tennis son complément.",
      },
    ],
  },
  {
    titre: "Histoire-géographie",
    motsCles: ["histoire", "geo", "geographie", "histoire geo"],
    exercices: [
      {
        titre: "La Révolution française",
        motsCles: ["revolution", "revolution francaise", "bastille"],
        question: "À quelle date a eu lieu la prise de la Bastille ?",
        choix: ["14 juillet 1789", "10 août 1792", "21 janvier 1793"],
        bonneReponse: "14 juillet 1789",
        indice: "La prise de la Bastille a lieu la même année que la Déclaration des droits de l’homme et du citoyen.",
        explication: "Oui. La Bastille est prise le 14 juillet 1789, au début de la Révolution française.",
      },
    ],
  },
];

function motsDe(texte: string) {
  return texte
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .match(/[a-z0-9]+/g)
    ?.join(" ") ?? "";
}

export function trouverMatiere(recherche: string): { matiere: Matiere; exercice: Exercice } | undefined {
  const mots = ` ${motsDe(recherche)} `;
  const correspond = (mot: string) => mots.includes(` ${mot} `);
  for (const matiere of matieres) {
    const exercice = matiere.exercices.find((item) => item.motsCles.some(correspond));
    if (exercice) return { matiere, exercice };
  }
  const matiere = matieres.find((item) => item.motsCles.some(correspond));
  return matiere ? { matiere, exercice: matiere.exercices[0]! } : undefined;
}
