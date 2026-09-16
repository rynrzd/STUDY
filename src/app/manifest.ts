import type { MetadataRoute } from "next";
import { MARQUE } from "@/lib/identite-legale";

/**
 * Manifeste PWA.
 *
 * Volontairement minimal : le produit s'utilise dans un navigateur, il n'y a
 * pas d'application installable à promettre. Le manifeste sert ici à donner un
 * nom et une icône corrects quand quelqu'un ajoute le site à son écran
 * d'accueil — c'est tout.
 */
export default function manifeste(): MetadataRoute.Manifest {
  return {
    name: MARQUE,
    short_name: MARQUE,
    description:
      "Cours, séances, devoirs et entraide, organisés par classe et contrôlés par l'établissement.",
    lang: "fr",
    start_url: "/",
    display: "browser",
    background_color: "#fafbfd",
    theme_color: "#fafbfd",
    icons: [
      { src: "/icon", sizes: "32x32", type: "image/png" },
      { src: "/apple-icon", sizes: "180x180", type: "image/png" },
    ],
  };
}
