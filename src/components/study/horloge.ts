"use client";

import { useSyncExternalStore } from "react";

/**
 * L'heure courante, à la minute, comme source externe : le rendu reste pur
 * (aucun Date.now() pendant le rendu), et tous les composants se mettent à
 * jour ensemble. Côté serveur : 0, ce qui désactive les actions limitées dans
 * le temps jusqu'à l'hydratation.
 */
let minute = 0;
const abonnes = new Set<() => void>();
let minuterie: number | null = null;

function abonner(rappel: () => void) {
  abonnes.add(rappel);
  if (minuterie === null) {
    minute = Math.floor(Date.now() / 60_000);
    minuterie = window.setInterval(() => {
      minute = Math.floor(Date.now() / 60_000);
      abonnes.forEach((a) => a());
    }, 30_000);
  }
  return () => {
    abonnes.delete(rappel);
    if (abonnes.size === 0 && minuterie !== null) {
      window.clearInterval(minuterie);
      minuterie = null;
    }
  };
}

export function useMinuteCourante(): number {
  return useSyncExternalStore(
    abonner,
    () => (minute === 0 ? Math.floor(Date.now() / 60_000) : minute),
    () => 0,
  );
}

/** Une valeur lue dans le stockage du navigateur, sans état synchronisé à la main. */
export function useStockage(cle: string, type: "local" | "session" = "local"): string | null {
  return useSyncExternalStore(
    (rappel) => {
      window.addEventListener("storage", rappel);
      return () => window.removeEventListener("storage", rappel);
    },
    () => {
      try {
        return (type === "local" ? window.localStorage : window.sessionStorage).getItem(cle);
      } catch {
        return null;
      }
    },
    () => null,
  );
}
