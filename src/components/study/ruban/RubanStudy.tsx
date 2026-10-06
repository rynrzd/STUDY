"use client";

import { Pause, Play } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { useEffets } from "../mouvement";
import type { Composition, Scene } from "./scene";

/**
 * Le ruban Study — signature graphique (brief §2).
 *
 * L'image fixe est rendue tout de suite, à dimensions réservées : la mise en
 * page ne saute pas, et le contenu ne dépend jamais de la 3D. La scène WebGL
 * n'est chargée que si :
 * - la composition l'autorise (`webgl`), sur un écran assez large ;
 * - les effets sont complets (ni réduits, ni désactivés) ;
 * - le ruban entre à l'écran.
 * Sinon, ou si WebGL manque, l'image reste. Le décor est masqué aux
 * technologies d'assistance ; seul le bouton de pause est atteignable.
 */

const IMAGES: Record<Composition, { src: string; largeur: number; hauteur: number }> = {
  grande: { src: "/visuels/ruban-grande.webp", largeur: 960, hauteur: 760 },
  petite: { src: "/visuels/ruban-petite.webp", largeur: 640, hauteur: 520 },
  fragment: { src: "/visuels/ruban-fragment.webp", largeur: 480, hauteur: 400 },
};

export function RubanStudy({
  composition,
  webgl = false,
  className = "",
  controle = true,
}: {
  composition: Composition;
  /** Autoriser la scène WebGL (ordinateur seulement). */
  webgl?: boolean;
  className?: string;
  /** Afficher le bouton de pause quand un mouvement est possible. */
  controle?: boolean;
}) {
  const hote = useRef<HTMLDivElement>(null);
  const scene = useRef<Scene | null>(null);
  const effets = useEffets();
  const [pret, setPret] = useState(false);
  const [enPause, setEnPause] = useState(false);
  const image = IMAGES[composition];
  const mouvement = effets === "complet";

  useEffect(() => {
    const el = hote.current;
    // Réduit ou désactivé : une scène immobile vaudrait l'image fixe, on ne la charge pas.
    if (!el || !webgl || effets !== "complet") return;
    if (!window.matchMedia("(min-width: 1024px)").matches) return;
    let annule = false;
    // Captures de recette (développement) : le rendu logiciel du navigateur sans écran est accepté.
    const logiciel = process.env.NODE_ENV !== "production" && new URLSearchParams(window.location.search).has("rendu-logiciel");
    const obs = new IntersectionObserver(async ([entree]) => {
      if (!entree?.isIntersecting || scene.current || annule) return;
      obs.disconnect();
      try {
        const { monterScene } = await import("./scene");
        if (annule) return;
        const s = await monterScene(el, {
          composition,
          mouvement,
          logicielAccepte: logiciel,
          abandon: () => {
            scene.current = null;
            setPret(false);
          },
        });
        if (annule) {
          s?.detruire();
          return;
        }
        scene.current = s;
        setPret(s !== null);
      } catch {
        setPret(false);
      }
    });
    obs.observe(el);
    return () => {
      annule = true;
      obs.disconnect();
      scene.current?.detruire();
      scene.current = null;
      setPret(false);
    };
  }, [composition, webgl, effets, mouvement]);

  useEffect(() => {
    scene.current?.pause(enPause);
  }, [enPause, pret]);

  return (
    <div className={`ruban ${className}`} data-composition={composition} data-pret={pret ? "oui" : "non"}>
      <div ref={hote} className="ruban-scene" aria-hidden="true">
        {/* eslint-disable-next-line @next/next/no-img-element -- image décorative locale, dimensions fixes, pas d'optimiseur distant */}
        <img src={image.src} width={image.largeur} height={image.hauteur} alt="" className="ruban-image" decoding="async" loading={composition === "grande" ? "eager" : "lazy"} />
      </div>
      {controle && pret && mouvement ? (
        <button type="button" className="ruban-pause" aria-pressed={enPause} onClick={() => setEnPause((v) => !v)}>
          {enPause ? <Play size={14} strokeWidth={1.75} aria-hidden="true" /> : <Pause size={14} strokeWidth={1.75} aria-hidden="true" />}
          {enPause ? "Reprendre l'animation" : "Mettre l'animation en pause"}
        </button>
      ) : null}
    </div>
  );
}
