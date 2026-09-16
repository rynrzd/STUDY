import type { MetadataRoute } from "next";
import { DOMAINE } from "@/lib/identite-legale";

/**
 * robots.txt.
 *
 * Ce fichier est une indication donnée aux moteurs, jamais une protection :
 * les espaces privés sont fermés par la session et par RLS, pas par cette
 * liste. On y interdit simplement l'indexation de ce qui n'a aucun sens dans
 * un résultat de recherche.
 */
export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/connexion", "/api/", "/app/", "/administration/"],
      },
    ],
    sitemap: `${DOMAINE}/sitemap.xml`,
    host: DOMAINE,
  };
}
