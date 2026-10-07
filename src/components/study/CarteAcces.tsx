import Link from "next/link";
import { CadreConnexion } from "./connexion/CadreConnexion";

/**
 * Écrans d'accès hors formulaire de connexion (rejoindre une classe, accès en
 * attente) : même coque que la connexion (R2, AuthShell), plus un retour
 * explicite. Aucune donnée scolaire n'y est chargée.
 */
export function CarteAcces({
  titre,
  sousTitre,
  children,
  retour = { href: "/connexion", libelle: "Retour à la connexion" },
}: {
  titre: string;
  sousTitre?: React.ReactNode;
  children: React.ReactNode;
  retour?: { href: string; libelle: string } | null;
}) {
  return (
    <CadreConnexion titre={titre} sousTitre={sousTitre}>
      {children}
      {retour ? (
        <p className="m-0 mt-8 border-t border-[color:var(--color-bordure)] pt-5">
          <Link href={retour.href} className="inline-flex min-h-[44px] items-center font-semibold text-[color:var(--color-accent)]">
            ← {retour.libelle}
          </Link>
        </p>
      ) : null}
    </CadreConnexion>
  );
}
