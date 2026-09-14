import { EntetePublic, PiedDePage } from "@/components/public/Chrome";

/**
 * Gabarit du site public (ch. 02) : en-tête et pied de page communs.
 *
 * Ce gabarit ne contraint volontairement pas la largeur. La landing a besoin
 * de bandes pleine largeur (la bande rose des élèves, la bande noire finale de
 * la nouvelle maquette) ; les pages secondaires ajoutent leur propre
 * conteneur de 1 200 px via le gabarit du groupe (site).
 *
 * L'entrée privée (/connexion) n'utilise pas ce gabarit : elle a son propre
 * cadre, dépouillé, pour qu'on ne confonde pas une page commerciale avec
 * l'écran où l'on saisit un identifiant.
 */
export default function GabaritPublic({ children }: { children: React.ReactNode }) {
  return (
    <>
      <EntetePublic />
      {children}
      <PiedDePage />
    </>
  );
}
