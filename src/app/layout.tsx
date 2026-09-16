import type { Metadata, Viewport } from "next";
import "../styles/globals.css";
import { DOMAINE, MARQUE } from "@/lib/identite-legale";

export const metadata: Metadata = {
  metadataBase: new URL(DOMAINE),
  // Titres et descriptions propres à chaque page (ch. 05, SEO).
  title: {
    default: `${MARQUE} — Le travail de la classe, au même endroit`,
    template: `%s — ${MARQUE}`,
  },
  description:
    "Cours, séances, devoirs et entraide, organisés par classe et contrôlés par " +
    "l'établissement. Licence annuelle pour les lycées, établie sur devis.",
  applicationName: MARQUE,
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    siteName: MARQUE,
    locale: "fr_FR",
    url: DOMAINE,
    title: `${MARQUE} — Le travail de la classe, au même endroit`,
    description:
      "Cours, séances, devoirs et entraide, organisés par classe et contrôlés par l'établissement.",
    images: [{ url: "/opengraph-image", width: 1200, height: 630, alt: MARQUE }],
  },
  twitter: { card: "summary_large_image" },
  icons: {
    icon: [{ url: "/icon", type: "image/svg+xml" }],
    apple: [{ url: "/apple-icon" }],
  },
  manifest: "/manifest.webmanifest",
  robots: {
    // Le site public est indexable ; les espaces privés ne le sont pas (ch. 05).
    // Chaque route privée redéfinit cette valeur, et robots.txt n'est jamais
    // considéré comme une protection d'accès.
    index: true,
    follow: true,
  },
};

export const viewport: Viewport = {
  themeColor: "#fafbfd",
  colorScheme: "light",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="fr">
      <body>
        <a className="lien-evitement" href="#contenu">
          Aller au contenu principal
        </a>
        {children}
      </body>
    </html>
  );
}
