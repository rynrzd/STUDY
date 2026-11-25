"use client";

import Link from "next/link";
import { Check, Search } from "lucide-react";
import { flushSync } from "react-dom";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { matieres, trouverMatiere, type Exercice } from "./matieres";
import s from "./accueil.module.css";

function Triangle({ solution }: { solution: boolean }) {
  return (
    <svg
      aria-label={solution
        ? "Le côté adjacent à l’angle est en bas. L’hypoténuse est le côté oblique."
        : "Triangle rectangle. L’angle étudié est en bas à gauche."}
      className={s.triangle}
      data-solution={solution}
      role="img"
      viewBox="0 0 320 145"
    >
      <path className={s.segment} d="M 40 126 L 260 126" pathLength="1" />
      <path className={s.verticale} d="M 260 126 L 260 19" pathLength="1" />
      <path className={s.segment} d="M 260 19 L 40 126" pathLength="1" />
      <path className={s.angle} d="M 73 110 Q 78 117 78 126 M 247 126 V 113 H 260" />
    </svg>
  );
}

function ExerciceInteractif({ exercice }: { exercice: Exercice }) {
  const [choix, setChoix] = useState("");
  const [indice, setIndice] = useState(false);
  const solution = choix === exercice.bonneReponse;

  return (
    <section className={s.exercice} aria-labelledby="question-exercice">
      {exercice.figure === "triangle" && <Triangle solution={solution} />}
      <h2 id="question-exercice">{exercice.question}</h2>
      <div className={s.reponses} role="group" aria-labelledby="question-exercice">
        {exercice.choix.map((option) => (
          <button key={option} type="button" aria-pressed={choix === option} onClick={() => setChoix(option)}>
            {option}
          </button>
        ))}
      </div>
      <div className={s.retour} aria-live="polite">
        {solution ? (
          <p><Check size={19} aria-hidden="true" />{exercice.explication}</p>
        ) : (
          <>
            {choix && <p>Essaie encore, tu peux prendre un indice.</p>}
            {indice && <p>{exercice.indice}</p>}
          </>
        )}
      </div>
      {solution ? (
        <div className={s.suite}>
          <span>Tu as une invitation de ton établissement ?</span>
          <Link href="/activer">Activer mon accès</Link>
        </div>
      ) : (
        <button className={s.indice} type="button" onClick={() => setIndice(!indice)} aria-expanded={indice}>
          {indice ? "Masquer l’indice" : "Voir un indice"}
        </button>
      )}
    </section>
  );
}

export function AccueilImmersif() {
  const [saisie, setSaisie] = useState("");
  const [recherche, setRecherche] = useState("");
  const [apercu, setApercu] = useState<ReturnType<typeof trouverMatiere>>();
  const titre = useRef<HTMLHeadingElement>(null);
  const champ = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (recherche) titre.current?.focus();
  }, [recherche]);

  function animer(changement: () => void) {
    if (!document.startViewTransition || window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      changement();
      return;
    }
    document.startViewTransition(() => flushSync(changement));
  }

  function chercher(texte: string) {
    const requete = texte.trim();
    animer(() => {
      setSaisie(requete);
      setRecherche(requete);
      setApercu(requete ? trouverMatiere(requete) : undefined);
    });
  }

  function soumettre(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    chercher(saisie);
  }

  return (
    <div className={s.page} data-mode={apercu ? "matiere" : "accueil"}>
      <header className={s.entete}>
        <Link className={s.marque} href="/" onNavigate={(event) => {
          event.preventDefault();
          chercher("");
          champ.current?.focus({ preventScroll: true });
        }}>
          study<span>.</span>
        </Link>
        <Link className={s.connexion} href="/connexion">Se connecter</Link>
      </header>

      <main id="contenu" className={s.contenu}>
        <form className={s.recherche} onSubmit={soumettre} role="search">
          <input
            ref={champ}
            aria-label="Rechercher une matière ou une notion"
            autoComplete="off"
            maxLength={120}
            onChange={(event) => setSaisie(event.target.value)}
            placeholder="Une matière, un chapitre…"
            type="search"
            value={saisie}
          />
          <button type="submit" aria-label="Rechercher"><Search size={22} aria-hidden="true" /></button>
        </form>

        {apercu ? (
          <div className={s.matiere} key={apercu.matiere.titre}>
            <div className={s.intro}>
              <h1 ref={titre} tabIndex={-1}>{apercu.matiere.titre}</h1>
              <div className={s.chapitres} role="group" aria-label="Choisir une notion">
                {apercu.matiere.exercices.map((exercice) => (
                  <button
                    key={exercice.titre}
                    type="button"
                    aria-pressed={apercu.exercice === exercice}
                    onClick={() => {
                      if (exercice !== apercu.exercice) animer(() => setApercu({ matiere: apercu.matiere, exercice }));
                    }}
                  >
                    {exercice.titre}
                  </button>
                ))}
              </div>
            </div>
            <ExerciceInteractif key={apercu.exercice.titre} exercice={apercu.exercice} />
          </div>
        ) : (
          <div className={s.accueil}>
            <h1 ref={titre} tabIndex={-1}>Tu veux travailler quoi aujourd’hui&nbsp;?</h1>
            <div className={s.aideRecherche}>
              {recherche && <p>Aucun exercice trouvé pour «&nbsp;{recherche}&nbsp;».</p>}
              <div className={s.chapitres} role="group" aria-label="Matières à essayer">
                {matieres.map((matiere) => (
                  <button type="button" key={matiere.titre} onClick={() => chercher(matiere.titre)}>{matiere.titre}</button>
                ))}
              </div>
            </div>
          </div>
        )}
      </main>

      <footer className={s.pied}>
        <Link href="/produit">La plateforme</Link>
        <Link href="/etablissements">Établissements</Link>
        <Link href="/aide">Aide</Link>
        <Link href="/confidentialite">Confidentialité</Link>
        <Link href="/mentions-legales">Mentions légales</Link>
      </footer>
    </div>
  );
}
