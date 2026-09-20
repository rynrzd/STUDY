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
        // Tous les espaces fermés, pas seulement trois. La liste précédente
        // oubliait /admin/, /eleve/, /professeur/, /studio/, /parametres et
        // /documents/ : rien de grave — ces routes redirigent vers la
        // connexion — mais un moteur y passait pour rien, et une adresse de
        // document signé n'a aucune raison d'être visitée par un robot.
        disallow: [
          "/activation",
          "/admin/",
          "/administration/",
          "/api/",
          "/app/",
          "/connexion",
          "/documents/",
          "/eleve/",
          "/mot-de-passe-oublie",
          "/parametres",
          "/professeur/",
          "/studio/",
        ],
      },
    ],
    sitemap: `${DOMAINE}/sitemap.xml`,
    host: DOMAINE,
  };
}
