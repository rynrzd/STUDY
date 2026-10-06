"use client";

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { COOKIE_EFFETS, lirePreference, type PreferenceEffets } from "@/lib/mouvement";

/**
 * Préférences de mouvement — brief §8.
 *
 * Trois niveaux effectifs :
 * - « complet » : préférence Automatique et système sans réduction ;
 * - « reduit » : préférence Réduits, ou Automatique avec réduction système ;
 * - « aucun » : préférence Désactivés.
 *
 * La préférence vit dans un cookie d'appareil (`study_effets`). Les pages
 * dynamiques la posent côté serveur sur leur conteneur ; `SynchroEffets` la
 * pose sur <html> au chargement. Le CSS s'accroche à `[data-effets]` ; les
 * composants passent par `useEffets`.
 */

export type NiveauEffets = "complet" | "reduit" | "aucun";

const EVENEMENT = "study:effets";

function lireCookie(): string | undefined {
  try {
    return new RegExp(`(?:^|; )${COOKIE_EFFETS}=([a-z]+)`).exec(document.cookie)?.[1];
  } catch {
    return undefined;
  }
}

function preferenceCourante(): PreferenceEffets {
  return lirePreference(document.documentElement.dataset.effets ?? lireCookie());
}

/** Pose la préférence de l'appareil sur <html>, une fois, au chargement. */
export function SynchroEffets() {
  useEffect(() => {
    document.documentElement.dataset.effets = lirePreference(lireCookie());
    window.dispatchEvent(new Event(EVENEMENT));
  }, []);
  return null;
}

/** Niveau effectif, lu directement (hors rendu). */
export function niveauEffets(): NiveauEffets {
  return niveau();
}

function niveau(): NiveauEffets {
  const p = preferenceCourante();
  if (p === "desactives") return "aucun";
  if (p === "reduits") return "reduit";
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "reduit" : "complet";
}

function abonner(rappel: () => void) {
  const requete = window.matchMedia("(prefers-reduced-motion: reduce)");
  requete.addEventListener("change", rappel);
  window.addEventListener(EVENEMENT, rappel);
  return () => {
    requete.removeEventListener("change", rappel);
    window.removeEventListener(EVENEMENT, rappel);
  };
}

/** Niveau d'effets effectif. Côté serveur : « reduit », l'hypothèse prudente. */
export function useEffets(): NiveauEffets {
  return useSyncExternalStore(abonner, niveau, () => "reduit");
}

/** Enregistre la préférence sur l'appareil et l'applique sans recharger. */
export function enregistrerPreference(p: PreferenceEffets) {
  try {
    document.cookie = `${COOKIE_EFFETS}=${p}; Path=/; Max-Age=${60 * 60 * 24 * 365}; SameSite=Lax${location.protocol === "https:" ? "; Secure" : ""}`;
  } catch {
    /* cookies bloqués : la préférence vaut pour cette page seulement */
  }
  document.documentElement.dataset.effets = p;
  // Les conteneurs rendus par le serveur portent l'ancienne valeur : on les aligne.
  document.querySelectorAll<HTMLElement>("[data-effets]").forEach((el) => {
    el.dataset.effets = p;
  });
  window.dispatchEvent(new Event(EVENEMENT));
}

export function usePreference(): PreferenceEffets {
  return useSyncExternalStore(abonner, preferenceCourante, () => "auto");
}

/**
 * Apparition unique d'une section (brief §3 et §6, « Reveal »).
 *
 * Le contenu est rendu visible côté serveur ; l'état masqué n'est posé
 * qu'après montage, seulement sous la ligne de flottaison et seulement si les
 * effets sont complets. Une fois apparue, la section ne rejoue jamais.
 */
export function Apparition({
  children,
  className,
  delai = 0,
  as: Balise = "div",
}: {
  children: React.ReactNode;
  className?: string;
  delai?: number;
  as?: "div" | "section" | "li" | "article";
}) {
  const noeud = useRef<HTMLDivElement>(null);
  const Element = Balise as "div";
  useEffect(() => {
    const el = noeud.current;
    if (!el || typeof IntersectionObserver === "undefined" || niveau() !== "complet") return;
    if (el.getBoundingClientRect().top < window.innerHeight * 0.92) return;
    el.dataset.revele = "prete";
    const obs = new IntersectionObserver(
      (entrees) => {
        if (entrees.some((e) => e.isIntersecting)) {
          el.dataset.revele = "visible";
          obs.disconnect();
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.08 },
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return (
    <Element ref={noeud} className={className} style={delai ? ({ "--delai": `${delai}ms` } as React.CSSProperties) : undefined}>
      {children}
    </Element>
  );
}

/**
 * Apparitions uniques pour les pages rendues côté serveur : chaque élément
 * `.apparition` situé sous la ligne de flottaison apparaît une fois quand il
 * entre à l'écran, puis plus jamais. Le défilement n'est ni lié ni détourné ;
 * sans script, tout est simplement visible.
 */
export function ObservateurApparitions() {
  useEffect(() => {
    if (typeof IntersectionObserver === "undefined" || niveau() !== "complet") return;
    const elements = [...document.querySelectorAll<HTMLElement>(".apparition")].filter(
      (el) => el.getBoundingClientRect().top >= window.innerHeight * 0.92,
    );
    if (elements.length === 0) return;
    const obs = new IntersectionObserver(
      (entrees) => {
        for (const e of entrees) {
          if (!e.isIntersecting) continue;
          (e.target as HTMLElement).dataset.revele = "visible";
          obs.unobserve(e.target);
        }
      },
      { rootMargin: "0px 0px -8% 0px", threshold: 0.05 },
    );
    for (const el of elements) {
      el.dataset.revele = "prete";
      obs.observe(el);
    }
    return () => obs.disconnect();
  }, []);
  return null;
}

/** Vrai pendant `duree` ms après chaque changement de `cle` (statut réel). */
export function useImpulsion(cle: unknown, duree = 700): boolean {
  const [actif, setActif] = useState(false);
  const premier = useRef(true);
  useEffect(() => {
    if (premier.current) {
      premier.current = false;
      return;
    }
    const debut = window.setTimeout(() => setActif(true), 0);
    const fin = window.setTimeout(() => setActif(false), duree);
    return () => {
      window.clearTimeout(debut);
      window.clearTimeout(fin);
    };
  }, [cle, duree]);
  return actif;
}
