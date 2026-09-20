import type { Metadata } from "next";
import { MARQUE } from "./identite-legale.ts";

/** L'image de partage, produite par `src/app/opengraph-image`. */
const IMAGE_SOCIALE = "/opengraph-image";

/**
 * Les métadonnées d'une page, dérivées d'un seul endroit.
 *
 * Elles étaient écrites page par page, et trois d'entre elles ne pouvaient pas
 * être justes : le gabarit racine posait `canonical: "/"` et
 * `openGraph.url: <domaine>`, que **toute** page héritait faute de les
 * redéfinir. Résultat mesuré en production : `/connexion` se déclarait
 * canonique vers l'accueil, et les onze pages publiques annonçaient la même
 * adresse Open Graph.
 *
 * Une page a une adresse et une seule. C'est donc elle qu'on donne ici, et le
 * reste en découle — canonique, `og:url`, `og:title`, `og:description`. On ne
 * peut plus en oublier une sans oublier les autres, ce qui se voit.
 */
export function pagePublique(options: {
  /** Chemin absolu depuis la racine, tel qu'il apparaîtra dans l'adresse. */
  chemin: string;
  titre: string;
  description: string;
}): Metadata {
  return {
    title: options.titre,
    description: options.description,
    alternates: { canonical: options.chemin },
    openGraph: {
      url: options.chemin,
      // Le titre social porte la marque : hors du site, « Offre » seul ne dit
      // rien de qui publie.
      title: `${options.titre} — ${MARQUE}`,
      description: options.description,
      // L'image doit être répétée ici. Next ne fusionne pas `openGraph` entre
      // le gabarit et la page : celui de la page remplace celui du gabarit, en
      // entier. L'omettre faisait disparaître l'image sociale de toutes les
      // pages — mesuré, pas supposé.
      images: [{ url: IMAGE_SOCIALE, width: 1200, height: 630, alt: MARQUE }],
    },
    robots: { index: true, follow: true },
  };
}

/**
 * Une page qui n'a rien à faire dans un index.
 *
 * `canonical: null` est explicite et nécessaire : sans lui, la page hérite de
 * la canonique du gabarit racine et se déclare être l'accueil. Une page privée
 * ne désigne aucune page canonique — elle n'en a pas.
 *
 * Le `noindex` ne protège rien : il demande. L'accès, lui, est refusé côté
 * serveur, et `robots.txt` n'est jamais considéré comme une barrière.
 */
export function pagePrivee(options: { titre: string; description: string }): Metadata {
  return {
    title: options.titre,
    description: options.description,
    alternates: { canonical: null },
    openGraph: { url: null },
    robots: { index: false, follow: false },
  };
}
