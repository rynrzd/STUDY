"use client";

import { useEffect, useState } from "react";

/**
 * Données locales de Study dans le navigateur : brouillons (`study-note-*`,
 * `study-brouillon-*`), copies hors ligne (`study-hors-ligne-*`, caches
 * `study-*`), service worker. Les préférences sans donnée personnelle
 * (cookie d'effets, établissement mémorisé) ne sont pas concernées.
 */
const PREFIXE = "study-";
const CLE_PROPRIETAIRE = "study-proprietaire";

function viderStockage(garder: readonly string[] = []) {
  for (const zone of [window.localStorage, window.sessionStorage]) {
    try {
      const cles: string[] = [];
      for (let i = 0; i < zone.length; i += 1) {
        const cle = zone.key(i);
        if (cle?.startsWith(PREFIXE) && !garder.includes(cle)) cles.push(cle);
      }
      for (const cle of cles) zone.removeItem(cle);
    } catch {
      /* stockage bloqué : rien à effacer */
    }
  }
}

/**
 * Après une déconnexion. Le serveur a déjà envoyé `Clear-Site-Data` ; ce
 * nettoyage couvre les navigateurs qui l'ignorent. Il annonce ce qu'il a
 * fait, sans promettre au-delà (téléchargements, historique, mots de passe
 * enregistrés restent sous le contrôle du navigateur).
 */
export function NettoyageApresDeconnexion() {
  useEffect(() => {
    viderStockage();
    if ("caches" in window) {
      void caches
        .keys()
        .then((cles) => Promise.all(cles.filter((c) => c.startsWith(PREFIXE)).map((c) => caches.delete(c))))
        .catch(() => undefined);
    }
    if ("serviceWorker" in navigator) {
      void navigator.serviceWorker
        .getRegistrations()
        .then((r) => Promise.all(r.map((x) => x.unregister())))
        .catch(() => undefined);
    }
  }, []);
  return null;
}

/**
 * Garde des brouillons, posée dans l'espace connecté.
 *
 * Une session qui expire ne déconnecte pas activement : les brouillons
 * restent, pour être retrouvés après reconnexion. Mais si une **autre**
 * personne se connecte sur ce navigateur (poste partagé), elle ne doit pas
 * les voir. On mémorise donc une empreinte de la personne propriétaire ; si
 * elle change, tout le stockage Study est vidé **avant** que les composants
 * ne le lisent (initialiseur d'état, exécuté au premier rendu, avant les
 * enfants).
 */
export function GardienBrouillons({ proprietaire, children }: { proprietaire: string; children: React.ReactNode }) {
  useState(() => {
    if (typeof window === "undefined") return true;
    try {
      const precedent = window.localStorage.getItem(CLE_PROPRIETAIRE);
      // Sans propriétaire connu, aucun brouillon historique n'est attribuable.
      // Ne jamais le donner au prochain compte connecté.
      if (precedent !== proprietaire) {
        viderStockage([CLE_PROPRIETAIRE]);
        if ("caches" in window) {
          void caches.keys().then((cles) => Promise.all(
            cles.filter((c) => c.startsWith(PREFIXE)).map((c) => caches.delete(c)),
          )).catch(() => undefined);
        }
        window.localStorage.setItem(CLE_PROPRIETAIRE, proprietaire);
      }
    } catch {
      /* stockage bloqué : les composants n'y trouveront rien non plus */
    }
    return true;
  });
  return children;
}
