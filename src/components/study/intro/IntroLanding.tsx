"use client";

import { BookOpen, Sparkles, Users } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { niveauEffets, useEffets } from "../mouvement";
import type { SceneIntro } from "./scene-intro";

/**
 * Introduction de la landing pilotée par le défilement (dossier V7, §3).
 *
 * Le défilement reste natif : aucun `preventDefault`, aucune capture de la
 * molette, du toucher ou de la barre d'espace. La progression se lit sur la
 * position de la section : p = clamp(-top / (hauteur - fenêtre), 0, 1) ;
 * remonter rejoue l'animation à l'envers.
 *
 * Le texte est du HTML réel. Les étapes masquées sont `inert` : pas de
 * contenu invisible atteignable au clavier.
 *
 * Mode statique (rendu serveur, sans script, effets réduits ou désactivés,
 * 3D indisponible) : les trois étapes l'une sous l'autre, sans long espace
 * vide, avec l'image fixe du logo. Le mode animé n'est posé qu'après montage,
 * si les effets sont complets.
 */
const lisse = (a: number, b: number, x: number) => {
  const t = Math.min(1, Math.max(0, (x - a) / (b - a)));
  return t * t * (3 - 2 * t);
};

export function IntroLanding({ apercu }: { apercu: React.ReactNode }) {
  const section = useRef<HTMLElement>(null);
  const hote = useRef<HTMLDivElement>(null);
  const etapes = useRef<(HTMLDivElement | null)[]>([]);
  const effets = useEffets();
  // Rendu serveur en mode animé : l’image fixe garde la même taille à
  // l’hydratation (sinon le LCP est retardé). La réduction système des
  // mouvements et l’absence de script basculent en statique par CSS, avant
  // le premier rendu ; les préférences « Réduits » ou « Désactivés », au montage.
  const [anime, setAnime] = useState(true);
  const [scenePrete, setScenePrete] = useState(false);

  // Mode animé seulement avec des effets complets.
  useEffect(() => {
    const id = window.setTimeout(() => setAnime(niveauEffets() === "complet"), 0);
    return () => window.clearTimeout(id);
  }, [effets]);

  // Progression au défilement (écouteur passif) et scène à la demande.
  useEffect(() => {
    const el = section.current;
    if (!anime || !el) return;
    let scene: SceneIntro | null = null;
    let annule = false;
    let image = 0;
    const noeuds = [...etapes.current];

    const calculer = () => {
      image = 0;
      const r = el.getBoundingClientRect();
      const course = r.height - window.innerHeight;
      const p = course > 0 ? Math.min(1, Math.max(0, -r.top / course)) : 0;
      const visibilites = [1 - lisse(0.18, 0.27, p), lisse(0.25, 0.34, p) * (1 - lisse(0.57, 0.65, p)), lisse(0.65, 0.74, p)];
      el.style.setProperty("--p", p.toFixed(4));
      visibilites.forEach((v, i) => {
        const etape = noeuds[i];
        if (!etape) return;
        etape.style.opacity = v.toFixed(3);
        etape.style.transform = `translateY(${((1 - v) * 16).toFixed(1)}px)`;
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
    if (!economie && hote.current) {
      const mobile = window.matchMedia("(max-width: 767px)").matches;
      const logiciel = process.env.NODE_ENV !== "production" && new URLSearchParams(window.location.search).has("rendu-logiciel");
      void import("./scene-intro")
        .then(({ monterIntro }) =>
          monterIntro(hote.current!, {
            mobile,
            logicielAccepte: logiciel,
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
          setScenePrete(s !== null);
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
      noeuds.forEach((e) => {
        if (!e) return;
        e.style.opacity = "";
        e.style.transform = "";
        e.inert = false;
      });
    };
  }, [anime]);

  return (
    <section ref={section} className="intro" data-mode={anime ? "anime" : "statique"} data-scene={scenePrete ? "oui" : "non"} aria-label="Présentation de Study">
      <noscript>
        <style>{".intro[data-mode=anime]{height:auto!important}.intro[data-mode=anime] .intro-scene,.intro[data-mode=anime] .intro-calques,.intro[data-mode=anime] .intro-etape{position:static!important;opacity:1!important;translate:none!important;height:auto!important}.intro[data-mode=anime] .intro-toile{position:relative!important;height:62svh!important}.intro-indice{display:none!important}"}</style>
      </noscript>
      <div className="intro-scene">
        <div ref={hote} className="intro-toile" aria-hidden="true">
          {/* eslint-disable-next-line @next/next/no-img-element -- image fixe locale, repli de la scène */}
          <img src="/visuels/intro-poster.webp" alt="" width={1440} height={900} className="intro-poster" decoding="async" fetchPriority="high" />
        </div>

        <div className="intro-calques">
          <div ref={(n) => { etapes.current[0] = n; }} className="intro-etape intro-etape-a">
            <p className="intro-accroche">
              Un univers à explorer.
              <br />
              Un outil pour avancer.
            </p>
            <p className="intro-indice" aria-hidden="true">
              Fais défiler pour entrer
            </p>
          </div>

          <div ref={(n) => { etapes.current[1] = n; }} className="intro-etape intro-etape-b">
            <ul className="intro-cartes">
              <li>
                <BookOpen size={22} strokeWidth={1.75} aria-hidden="true" />
                <strong>Cours</strong>
                <span>Les séances et leurs supports, publiés par tes professeurs.</span>
              </li>
              <li>
                <Sparkles size={22} strokeWidth={1.75} aria-hidden="true" />
                <strong>Révisions</strong>
                <span>Des fiches tirées de tes cours, des rappels au bon moment.</span>
              </li>
              <li>
                <Users size={22} strokeWidth={1.75} aria-hidden="true" />
                <strong>Classe</strong>
                <span>Le salon de ta classe, les questions et l&apos;entraide.</span>
              </li>
            </ul>
          </div>

          <div ref={(n) => { etapes.current[2] = n; }} className="intro-etape intro-etape-c">
            <p className="intro-titre-fin">Ton espace pour avancer.</p>
            <div className="intro-apercu">{apercu}</div>
          </div>
        </div>

        <a href="#apres-intro" className="intro-passer">
          Passer l&apos;introduction
        </a>
      </div>
    </section>
  );
}
