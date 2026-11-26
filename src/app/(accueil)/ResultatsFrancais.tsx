import { ChevronDown } from "lucide-react";
import type { Ref } from "react";
import { motsDe } from "./matieres";
import s from "./accueil.module.css";

const METHODES = [
  {
    titre: "Commentaire de texte",
    description: "Partir d'une citation pour construire une analyse.",
    motsCles: ["commentaire", "commentaires"],
    methode: "Choisis quelques mots du texte. Repère le procédé utilisé, puis explique ce qu'il fait ressentir au lecteur.",
    consigne: "« La nuit avalait les rues. » Quelle impression donne le verbe « avalait » ?",
    exemple: "« Avalait » personnifie la nuit. Elle semble se refermer sur la ville et crée une impression d'inquiétude.",
  },
  {
    titre: "Dissertation",
    description: "Transformer un sujet en question à discuter.",
    motsCles: ["dissertation", "dissertations"],
    methode: "Repère les mots du sujet à interroger. Trouve deux réponses possibles avant de chercher tes exemples dans l'œuvre.",
    consigne: "« Le rire sert-il seulement à divertir ? » Quel mot invite à nuancer la réponse ?",
    exemple: "« Seulement » invite à chercher d'autres fonctions du rire : divertir, mais aussi critiquer ou dénoncer une injustice.",
  },
  {
    titre: "Oral du bac",
    description: "Défendre une lecture avec un exemple précis.",
    motsCles: ["oral", "presentation de l oeuvre", "bac francais"],
    methode: "Choisis un passage marquant. Situe-le en une phrase, puis explique pourquoi il a retenu ton attention.",
    consigne: "Prends une œuvre étudiée. Quel passage aimerais-tu défendre devant l'examinateur ?",
    exemple: "Dans Les Fausses Confidences, la scène de la lettre dictée par Araminte m'a marqué : elle révèle sa façon de mettre Dorante à l'épreuve.",
  },
] as const;

export function trouverMethodeFrancais(recherche: string) {
  const mots = ` ${motsDe(recherche)} `;
  return METHODES.find(({ motsCles }) => motsCles.some((mot) => mots.includes(` ${mot} `)));
}

export function ResultatsFrancais({ titre, methode, chercher }: {
  titre: Ref<HTMLHeadingElement>;
  methode: ReturnType<typeof trouverMethodeFrancais>;
  chercher: (recherche: string) => void;
}) {
  return (
    <section className={s.francais} aria-labelledby="titre-francais">
      <header className={s.enteteFrancais}>
        <span>Première · Français</span>
        <h1 id="titre-francais" ref={titre} tabIndex={-1}>Qu&apos;est-ce que tu veux travailler ?</h1>
        <p>Choisis une méthode. Une idée claire, un exemple, puis à toi d&apos;essayer.</p>
      </header>

      <div className={s.methodes}>
        {METHODES.map((item) => (
          <details key={item.titre} name="methodes-francais" open={item === methode}>
            <summary>
              <span className={s.nomMethode}>
                <strong>{item.titre}</strong>
                <span>{item.description}</span>
              </span>
              <ChevronDown size={20} aria-hidden="true" />
            </summary>
            <div className={s.methode}>
              <p>{item.methode}</p>
              <blockquote>{item.consigne}</blockquote>
              <details className={s.correction}>
                <summary>Voir un exemple de réponse</summary>
                <p>{item.exemple}</p>
              </details>
            </div>
          </details>
        ))}
      </div>

      <section className={s.entrainement} aria-labelledby="titre-entrainement">
        <h2 id="titre-entrainement">Envie d&apos;essayer un exercice ?</h2>
        <div>
          {["Figures de style", "Argumentation"].map((exercice) => (
            <button key={exercice} type="button" onClick={() => chercher(exercice)}>{exercice}</button>
          ))}
        </div>
      </section>
    </section>
  );
}
