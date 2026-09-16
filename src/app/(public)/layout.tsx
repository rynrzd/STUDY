import { Entete } from "@/components/site/Entete";
import { PiedDePage } from "@/components/site/PiedDePage";

/**
 * Gabarit du site public : en-tête collant et pied de page légal.
 *
 * La largeur n'est pas contrainte ici. Les pages ont besoin de bandes pleine
 * largeur ; c'est la classe `.contenu` de chaque section qui ramène le texte
 * aux 1 220 px du cahier de finition.
 *
 * L'entrée privée (/connexion) n'utilise pas ce gabarit : elle a son propre
 * cadre, dépouillé, pour qu'on ne confonde pas une page commerciale avec
 * l'écran où l'on saisit un identifiant.
 */
export default function GabaritPublic({ children }: { children: React.ReactNode }) {
  return (
    <div className="sans-debordement flex min-h-screen flex-col">
      <Entete />
      <div className="flex-1">{children}</div>
      <PiedDePage />
    </div>
  );
}
