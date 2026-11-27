"use client";

import { usePathname } from "next/navigation";
import { MoreHorizontal } from "lucide-react";
import {
  useCallback, useEffect, useLayoutEffect, useRef, useState,
  type CSSProperties, type MouseEvent, type ReactNode,
} from "react";
import { etapeRessort } from "@/lib/animation-navigation-mobile";
import { indexNavigationMobile, type CibleNavigationMobile } from "@/lib/navigation-mobile";
import { niveauEffets } from "./mouvement";

const CLE_TRANSITION = "study:nav-mobile:transition";

interface Ressort {
  position: number;
  vitesse: number;
  cible: number;
  image: number;
  precedent: number;
}

/**
 * La bulle et l'encoche partagent une animation physique, image par image.
 * Le mouvement reprend même si Next remonte la barre entre deux espaces.
 */
export function NavigationMobile({
  principales, autres, icones, children,
}: {
  principales: readonly CibleNavigationMobile[];
  autres: readonly CibleNavigationMobile[];
  icones: readonly ReactNode[];
  children: ReactNode;
}) {
  const chemin = usePathname() ?? "";
  const actif = indexNavigationMobile(chemin, principales, autres);
  const [intention, definirIntention] = useState<{ chemin: string; index: number } | null>(null);
  const [plusOuvert, definirPlusOuvert] = useState(false);
  const minuteur = useRef<ReturnType<typeof setTimeout> | null>(null);
  const selection = intention?.chemin === chemin ? intention.index : actif;
  const position = plusOuvert ? 4 : selection;
  const cible = (position >= 0 ? position : 0) * 20 + 10;
  const premiereCible = useRef(cible);
  const barre = useRef<HTMLElement>(null);
  const ressort = useRef<Ressort>({ position: cible, vitesse: 0, cible, image: 0, precedent: 0 });

  const animerVers = useCallback((pourcentage: number) => {
    const element = barre.current;
    if (!element) return;
    const mouvement = ressort.current;
    mouvement.cible = pourcentage;

    if (document.hidden || niveauEffets() !== "complet") {
      if (mouvement.image) cancelAnimationFrame(mouvement.image);
      mouvement.position = pourcentage;
      mouvement.vitesse = 0;
      mouvement.image = 0;
      mouvement.precedent = 0;
      element.style.setProperty("--onglet-position", `${pourcentage}%`);
      return;
    }

    if (mouvement.image) return;
    mouvement.precedent = 0;
    const imageSuivante = (maintenant: number) => {
      mouvement.image = 0;
      const facteur = mouvement.precedent === 0 ? 1 : (maintenant - mouvement.precedent) / (1000 / 60);
      mouvement.precedent = maintenant;
      const suite = etapeRessort(mouvement.position, mouvement.vitesse, mouvement.cible, facteur);
      mouvement.position = suite.position;
      mouvement.vitesse = suite.vitesse;

      if (Math.abs(mouvement.position - mouvement.cible) < 0.06 && Math.abs(mouvement.vitesse) < 0.06) {
        mouvement.position = mouvement.cible;
        mouvement.vitesse = 0;
      } else {
        mouvement.image = requestAnimationFrame(imageSuivante);
      }
      element.style.setProperty("--onglet-position", `${mouvement.position}%`);
    };
    mouvement.image = requestAnimationFrame(imageSuivante);
  }, []);

  useLayoutEffect(() => {
    const element = barre.current;
    if (!element) return;
    const mouvement = ressort.current;
    let depart = premiereCible.current;

    try {
      const valeur = sessionStorage.getItem(CLE_TRANSITION);
      if (valeur) {
        const dernier = JSON.parse(valeur) as { position?: number; date?: number };
        if (typeof dernier.position === "number" && Number.isFinite(dernier.position) &&
            typeof dernier.date === "number" && Date.now() - dernier.date < 2500) {
          depart = Math.max(6, Math.min(94, dernier.position));
        }
      }
    } catch { /* Le stockage désactivé ne doit jamais bloquer la navigation. */ }

    mouvement.position = depart;
    mouvement.vitesse = 0;
    element.style.setProperty("--onglet-position", `${depart}%`);
    animerVers(premiereCible.current);

    const limiterMouvement = () => {
      if (document.hidden || niveauEffets() !== "complet") {
        animerVers(mouvement.cible);
      }
    };
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    preference.addEventListener("change", limiterMouvement);
    window.addEventListener("study:effets", limiterMouvement);
    document.addEventListener("visibilitychange", limiterMouvement);

    return () => {
      if (mouvement.image) cancelAnimationFrame(mouvement.image);
      mouvement.image = 0;
      try {
        sessionStorage.setItem(CLE_TRANSITION, JSON.stringify({ position: mouvement.position, date: Date.now() }));
      } catch { /* Continuer sans conserver la position. */ }
      preference.removeEventListener("change", limiterMouvement);
      window.removeEventListener("study:effets", limiterMouvement);
      document.removeEventListener("visibilitychange", limiterMouvement);
      if (minuteur.current) clearTimeout(minuteur.current);
    };
  }, [animerVers]);

  useEffect(() => { animerVers(cible); }, [cible, animerVers]);

  useEffect(() => {
    const detail = barre.current?.querySelector(":scope > details");
    if (!(detail instanceof HTMLDetailsElement)) return;
    const basculer = () => definirPlusOuvert(detail.open);
    detail.addEventListener("toggle", basculer);
    return () => detail.removeEventListener("toggle", basculer);
  }, []);

  const toucherDestination = (evenement: MouseEvent<HTMLElement>) => {
    const origine = evenement.target;
    if (!(origine instanceof Element)) return;
    const lien = origine.closest("a[data-onglet-index]");
    if (!(lien instanceof HTMLAnchorElement) || !evenement.currentTarget.contains(lien)) return;
    if (evenement.metaKey || evenement.ctrlKey || evenement.shiftKey || evenement.altKey) return;
    const index = Number(lien.dataset.ongletIndex);
    if (!Number.isInteger(index) || index < 0 || index > 3) return;
    if (minuteur.current) clearTimeout(minuteur.current);
    animerVers(index * 20 + 10);
    definirIntention({ chemin, index });
    minuteur.current = setTimeout(() => {
      definirIntention(null);
      minuteur.current = null;
    }, 2000);
  };

  return (
    <nav
      ref={barre}
      className="app-nav-mobile app-nav-mobile-animee"
      aria-label="Destinations"
      style={{ "--onglet-depart": `${cible}%` } as CSSProperties}
      data-selection={position >= 0 ? "oui" : "non"}
      data-onglet-visuel={position}
      onClickCapture={toucherDestination}
    >
      <span className="app-nav-mobile-bulle" aria-hidden="true">
        <span className="app-nav-mobile-bulle-icone" key={position}>
          {position === 4 ? <MoreHorizontal size={23} strokeWidth={1.85} /> : icones[position] ?? null}
        </span>
        <span className="app-nav-mobile-bulle-plus"><MoreHorizontal size={23} strokeWidth={1.85} /></span>
      </span>
      {children}
    </nav>
  );
}
