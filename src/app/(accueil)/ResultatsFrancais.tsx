import { ChevronDown, ChevronRight } from "lucide-react";
import type { Ref } from "react";
import { motsDe } from "./matieres";
import s from "./accueil.module.css";

const methodes = [
  {
    titre: "Commentaire de texte",
    description: "Passer d’une citation à une analyse.",
    motsCles: ["commentaire", "commentaires"],
    methode: "Cite quelques mots du texte, nomme le procédé, puis explique ce qu’il fait comprendre ou ressentir.",
    consigne: "« La nuit avalait les rues. » Quelle impression donne le verbe « avalait » ?",
    exemple: "« Avalait » personnifie la nuit. Elle semble se refermer sur la ville, ce qui rend la scène inquiétante.",
  },
  {
    titre: "Dissertation",
    description: "Transformer un sujet en question à discuter.",
    motsCles: ["dissertation", "dissertations"],
    methode: "Repère le mot qui donne au sujet sa difficulté. Formule deux réponses possibles avant de chercher des exemples dans l’œuvre.",
    consigne: "« Le rire sert-il seulement à divertir ? » Quel mot t’invite à nuancer ta réponse ?",
    exemple: "« Seulement » invite à envisager d’autres fonctions du rire. Il peut divertir, mais aussi faire ressortir un défaut ou critiquer une injustice.",
  },
  {
    titre: "Oral du bac",
    description: "Présenter une œuvre avec un exemple précis.",
    motsCles: ["oral", "presentation de l oeuvre"],
    methode: "Choisis un passage qui t’a marqué. Situe-le brièvement, puis explique ce qu’il a changé dans ta lecture de l’œuvre.",
    consigne: "Prends une œuvre que tu as lue. En deux phrases, présente un passage que tu aimerais défendre à l’oral.",
    exemple: "Dans Les Fausses Confidences, la scène où Araminte dicte une lettre à Dorante m’a marqué. Elle m’a fait voir Araminte comme quelqu’un qui sait aussi mettre les autres à l’épreuve.",
  },
] as const;

export function trouverMethodeFrancais(recherche: string) {
  const mots = ` ${motsDe(recherche)} `;
  return methodes.find(({ motsCles }) => motsCles.some((mot) => mots.includes(` ${mot} `)));
}

export function ResultatsFrancais({ titre, methode, chercher }: {
  titre: Ref<HTMLHeadingElement>;
  methode: ReturnType<typeof trouverMethodeFrancais>;
  chercher: (recherche: string) => void;
}) {
  return (
    <section className={s.francais} aria-labelledby="titre-francais">
      <header>
        <h1 id="titre-francais" ref={titre} tabIndex={-1}>Français</h1>
        <p>Préparer le bac · Première</p>
      </header>
      <div className={s.methodes}>
        {methodes.map((item) => (
          <details key={item.titre} name="methodes-francais" open={item === methode}>
            <summary>
              <span>
                <strong>{item.titre}</strong>
                <span>{item.description}</span>
              </span>
              <ChevronDown size={20} aria-hidden="true" />
            </summary>
            <div className={s.methode}>
              <p>{item.methode}</p>
              <p className={s.consigne}>{item.consigne}</p>
              <details className={s.correction}>
                <summary>Voir un exemple de réponse</summary>
                <p>{item.exemple}</p>
              </details>
            </div>
          </details>
        ))}
      </div>
      <section className={s.entrainement} aria-labelledby="titre-entrainement">
        <h2 id="titre-entrainement">S’entraîner</h2>
        <div>
          {["Figures de style", "Argumentation"].map((exercice) => (
            <button key={exercice} type="button" onClick={() => chercher(exercice)}>
              {exercice}<ChevronRight size={16} aria-hidden="true" />
            </button>
          ))}
        </div>
      </section>
    </section>
  );
}
