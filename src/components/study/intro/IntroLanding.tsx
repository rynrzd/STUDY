"use client";

import Link from "next/link";
import { BookOpen, Sparkles, Users } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { niveauEffets, useEffets } from "../mouvement";
import { LOGO_LETTRES, LOGO_POINT, LOGO_VIEWBOX_SERRE } from "./logo-svg";
import type { SceneIntro } from "./scene-intro";

/**
 * Hero unique de la landing (cahier « corrections de la landing », §5 à §8).
 *
 * Une seule arrivée : le logo et le ruban dans une zone de scène, le message
 * et les accès dans une zone HTML distincte en dessous — jamais l'un sur
 * l'autre. Au défilement, le logo se retire entièrement AVANT que le second
 * message (« Tout ce qu'il faut pour avancer. » et les trois cartes) arrive,
 * puis le décor sort ; la page enchaîne sur les sections existantes, sans
 * second hero.
 *
 * Défilement natif : aucun `preventDefault`, progression lue sur la position
 * de la section, réversible. Les étapes masquées sont `inert`.
 *
 * Mode statique (rendu serveur avant montage si la réduction des mouvements
 * est demandée, sans script, effets réduits, fenêtre trop basse ou 3D
 * indisponible) : la scène fixe, le message, puis les cartes, en flux.
 *
 * Calage : la position et la taille du logo sont décidées par le CSS
 * (`.intro-logo`, `.intro-poster`). La scène 3D les mesure et s'y ajuste ;
 * l'image fixe, le logo HTML et le logo 3D occupent donc le même rectangle.
 */
const lisse = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

/** Hauteur de fenêtre en dessous de laquelle le récit collant couperait le texte. */
const HAUTEUR_MIN_ANIME = 540;

export function IntroLanding() {
  const section = useRef<HTMLElement>(null);
  const hote = useRef<HTMLDivElement>(null);
  const logoHtml = useRef<SVGSVGElement>(null);
  const affiche = useRef<HTMLImageElement>(null);
  const etapes = useRef<(HTMLDivElement | null)[]>([]);
  const effets = useEffets();
  // Rendu serveur en mode animé (même géométrie qu'au premier cadre, LCP
  // stable) ; la réduction système des mouvements et l'absence de script
  // basculent en statique par CSS avant le premier rendu.
  const [anime, setAnime] = useState(true);
  const [scenePrete, setScenePrete] = useState(false);

  // Mode animé : effets complets et fenêtre assez haute pour le récit.
  useEffect(() => {
    const decider = () => setAnime(niveauEffets() === "complet" && window.innerHeight >= HAUTEUR_MIN_ANIME);
    const id = window.setTimeout(decider, 0);
    window.addEventListener("resize", decider, { passive: true });
    window.addEventListener("orientationchange", decider, { passive: true });
    return () => {
      window.clearTimeout(id);
      window.removeEventListener("resize", decider);
      window.removeEventListener("orientationchange", decider);
    };
  }, [effets]);

  // Progression au défilement (écouteur passif) et scène à la demande.
  useEffect(() => {
    const el = section.current;
    if (!anime || !el) return;
    let scene: SceneIntro | null = null;
    let annule = false;
    let image = 0;
    const noeuds = [...etapes.current];
    const cadre = el.querySelector<HTMLElement>(".intro-scene");

    const calculer = () => {
      image = 0;
      const r = el.getBoundingClientRect();
      const haut = cadre ? parseFloat(getComputedStyle(cadre).top) || 0 : 0;
      const hauteurCadre = cadre?.offsetHeight ?? window.innerHeight;
      const course = r.height - hauteurCadre;
      const p = course > 0 ? Math.min(1, Math.max(0, (haut - r.top) / course)) : 0;
      // A : message d'arrivée. B : « Tout ce qu'il faut pour avancer. »
      // B n'apparaît qu'à 0,42, quand le logo est entièrement retiré (0,36).
      const visibilites = [1 - lisse(0.16, 0.28, p), lisse(0.42, 0.52, p)];
      el.style.setProperty("--p", p.toFixed(4));
      visibilites.forEach((v, i) => {
        const etape = noeuds[i];
        if (!etape) return;
        etape.style.opacity = v.toFixed(3);
        etape.style.transform = `translateY(${((1 - v) * (i === 0 ? -12 : 16)).toFixed(1)}px)`;
        etape.inert = v < 0.5;
      });
      scene?.progression(p);
    };
    const demander = () => {
      if (image === 0) image = requestAnimationFrame(calculer);
    };
    window.addEventListener("scroll", demander, { passive: true });
    window.addEventListener("resize", demander, { passive: true });
    window.addEventListener("orientationchange", demander, { passive: true });
    calculer();

    const economie = (navigator as Navigator & { connection?: { saveData?: boolean } }).connection?.saveData === true;
    if (!economie && hote.current && logoHtml.current && affiche.current) {
      const parametres = new URLSearchParams(window.location.search);
      const developpement = process.env.NODE_ENV !== "production";
      void import("./scene-intro")
        .then(({ monterIntro }) =>
          monterIntro(hote.current!, {
            logo: logoHtml.current!,
            ruban: affiche.current!,
            mobile: window.matchMedia("(max-width: 767px)").matches,
            logicielAccepte: developpement && parametres.has("rendu-logiciel"),
            // Génération de l'image fixe (développement) : ruban seul.
            sansLogo: developpement && parametres.has("affiche-ruban"),
            // Remplacement de l'image fixe seulement après une image valide.
            premiereImage: () => {
              if (!annule) setScenePrete(true);
            },
            abandon: () => {
              scene = null;
              setScenePrete(false);
            },
          }),
        )
        .then((s) => {
          if (annule) {
            s?.detruire();
            return;
          }
          scene = s;
          demander();
        })
        .catch(() => setScenePrete(false));
    }

    return () => {
      annule = true;
      if (image) cancelAnimationFrame(image);
      window.removeEventListener("scroll", demander);
      window.removeEventListener("resize", demander);
      window.removeEventListener("orientationchange", demander);
      scene?.detruire();
      scene = null;
      setScenePrete(false);
      noeuds.forEach((e) => {
        if (!e) return;
        e.style.opacity = "";
        e.style.transform = "";
        e.inert = false;
      });
    };
  }, [anime]);

  /**
   * « Passer » : défilement natif jusqu'à la section suivante (sa marge de
   * défilement la garde sous l'en-tête collant), focus sur son titre.
   */
  const passer = (evenement: React.MouseEvent<HTMLAnchorElement>) => {
    const suite = document.getElementById("apres-intro");
    const titre = document.getElementById("apres-intro-titre");
    if (!suite || !titre) return;
    evenement.preventDefault();
    suite.scrollIntoView({ block: "start", behavior: niveauEffets() === "complet" ? "smooth" : "auto" });
    titre.focus({ preventScroll: true });
    history.replaceState(null, "", "#apres-intro");
  };

  return (
    <section
      ref={section}
      className="intro"
      data-mode={anime ? "anime" : "statique"}
      data-scene={scenePrete ? "oui" : "non"}
      aria-labelledby="hero-titre"
    >
      <noscript>
        <style>{".intro[data-mode=anime]{height:auto!important}.intro[data-mode=anime] .intro-scene{position:relative!important;top:auto!important;height:auto!important;overflow:visible!important}.intro[data-mode=anime] .intro-toile{position:relative!important;inset:auto!important;height:var(--zone)!important}.intro[data-mode=anime] .intro-logo,.intro[data-mode=anime] .intro-poster{top:calc(var(--zone)*.52)!important;opacity:1!important}.intro[data-mode=anime] .intro-etape{position:relative!important;left:auto!important;top:auto!important;translate:none!important;opacity:1!important;transform:none!important}.intro[data-mode=anime] .intro-etape-a{padding-bottom:40px!important}.intro[data-mode=anime] .intro-etape-b{padding:40px 0 64px!important}"}</style>
      </noscript>
      <div className="intro-scene">
        <div ref={hote} className="intro-toile" aria-hidden="true">
          {/* Image fixe du ruban seul (le logo est en HTML), calée autour du
              logo. Remplacée par la 3D après sa première image valide. */}
          {/* eslint-disable-next-line @next/next/no-img-element -- image fixe locale, repli de la scène */}
          <img ref={affiche} src="/visuels/intro-ruban.webp" alt="" width={1600} height={800} className="intro-poster" decoding="async" fetchPriority="high" />
          <svg ref={logoHtml} className="intro-logo" viewBox={LOGO_VIEWBOX_SERRE} aria-hidden="true" focusable="false">
            <g transform="scale(1,-1)">
              <path fill="#29282e" d={LOGO_LETTRES} />
              <path fill="#c37a94" d={LOGO_POINT} />
            </g>
          </svg>
        </div>

        <a href="#apres-intro" onClick={passer} className="intro-passer">
          Passer<span className="sr-only"> l&apos;introduction</span>
          <span aria-hidden="true">→</span>
        </a>

        <div ref={(n) => { etapes.current[0] = n; }} className="intro-etape intro-etape-a">
          <h1 id="hero-titre" className="intro-titre">
            Ta classe, <span className="intro-saut">tout simplement.</span>
          </h1>
          <p className="intro-description">Les cours, les devoirs et l&apos;entraide, au même endroit.</p>
          <div className="intro-actions">
            <Link href="/connexion" className="bouton bouton-primaire intro-cta">
              Se connecter
            </Link>
            <Link href="#fonctionnement" className="lien-fleche intro-decouvrir">
              Découvrir la plateforme
              <span aria-hidden="true" className="fleche">→</span>
            </Link>
          </div>
          <p className="intro-lycee">
            Un établissement ? <Link href="/etablissements">Équiper mon lycée</Link>
          </p>
        </div>

        <div ref={(n) => { etapes.current[1] = n; }} className="intro-etape intro-etape-b">
          <h2 className="intro-sous-titre">Tout ce qu&apos;il faut pour avancer.</h2>
          <ul className="intro-cartes">
            <li>
              <span className="intro-icone"><BookOpen size={20} strokeWidth={1.75} aria-hidden="true" /></span>
              <strong>Cours</strong>
              <span>Les séances et leurs supports, publiés par tes professeurs.</span>
            </li>
            <li>
              <span className="intro-icone"><Sparkles size={20} strokeWidth={1.75} aria-hidden="true" /></span>
              <strong>Révisions</strong>
              <span>Des fiches tirées de tes cours, des rappels au bon moment.</span>
            </li>
            <li>
              <span className="intro-icone"><Users size={20} strokeWidth={1.75} aria-hidden="true" /></span>
              <strong>Classe</strong>
              <span>Le salon de ta classe, les questions et l&apos;entraide.</span>
            </li>
          </ul>
        </div>
      </div>
    </section>
  );
}
