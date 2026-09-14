import type { Metadata } from "next";
import "../styles/globals.css";

export const metadata: Metadata = {
  // Titres et descriptions propres à chaque page (ch. 05, SEO).
  title: {
    default: "study. — le cours, les devoirs et l'entraide",
    template: "%s — study.",
  },
  description:
    "Un espace privé pour les lycées : préparer les séances, publier les cours par classe, " +
    "retrouver les devoirs et les corrections. Sur ordinateur, sur papier et à la maison.",
  applicationName: "study.",
  robots: {
    // Le site public est indexable ; les espaces privés et la démonstration ne
    // le sont pas (ch. 05). Chaque route privée redéfinit cette valeur, et
    // robots.txt n'est jamais considéré comme une protection d'accès.
    index: true,
    follow: true,
  },
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
