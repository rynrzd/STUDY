import type { MetadataRoute } from "next";
import { DOMAINE } from "@/lib/identite-legale";

/**
 * Plan du site.
 *
 * Seules les pages publiques réellement livrées y figurent. Une page annoncée
 * mais absente dans un sitemap donne une erreur 404 aux moteurs et, pire, à un
 * établissement qui suit le lien.
 */

const PAGES = [
  { chemin: "/", priorite: 1 },
  { chemin: "/produit", priorite: 0.9 },
  { chemin: "/etablissements", priorite: 0.9 },
  { chemin: "/securite", priorite: 0.8 },
  { chemin: "/offre", priorite: 0.8 },
  { chemin: "/aide", priorite: 0.5 },
  { chemin: "/contact", priorite: 0.5 },
  { chemin: "/accessibilite", priorite: 0.4 },
  { chemin: "/mentions-legales", priorite: 0.3 },
  { chemin: "/confidentialite", priorite: 0.3 },
  { chemin: "/conditions", priorite: 0.3 },
] as const;

export default function sitemap(): MetadataRoute.Sitemap {
  const modifie = new Date();
  return PAGES.map((page) => ({
    url: `${DOMAINE}${page.chemin}`,
    lastModified: modifie,
    changeFrequency: "monthly",
    priority: page.priorite,
  }));
}
