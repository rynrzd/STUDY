import type { Metadata } from "next";
import { notFound } from "next/navigation";

/**
 * Aperçus de développement — recette visuelle du brief 3D.
 *
 * Ces pages rendent les composants d'interface avec des données **fictives**,
 * pour les captures et les mesures, sans session ni base. Elles n'existent
 * pas en production : `notFound()` avant tout rendu, et aucune ne lit ni
 * n'écrit de donnée réelle.
 */
export const metadata: Metadata = { title: "Aperçu de développement", robots: { index: false, follow: false } };

export default function GabaritApercu({ children }: { children: React.ReactNode }) {
  if (process.env.NODE_ENV === "production") notFound();
  return children;
}
