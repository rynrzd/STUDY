import Link from "next/link";
import { Entete } from "@/components/site/Entete";
import { PiedDePage } from "@/components/site/PiedDePage";

/**
 * Page 404 — ch. 19, « vide utile avec action ».
 *
 * Une page d'erreur qui ne propose rien laisse la personne bloquée. Celle-ci
 * dit ce qui a pu se passer et où aller. Elle ne révèle jamais le titre d'une
 * ressource : une page privée à laquelle on n'a pas droit est indiscernable
 * d'une page inexistante (politique de non-divulgation, ch. 22).
 */

const PISTES = [
  ["/", "Accueil"],
  ["/produit", "Produit"],
  ["/etablissements", "Pour les établissements"],
  ["/offre", "Offre"],
  ["/aide", "Aide"],
] as const;

export default function Introuvable() {
  return (
    <div className="sans-debordement flex min-h-screen flex-col">
      <Entete />
      <main id="contenu" className="flex-1">
        <div className="contenu py-20 md:py-28">
          <p className="surtitre m-0">Erreur 404</p>
          <h1 className="mt-4 max-w-[18ch] text-[length:var(--text-h1-mobile)] leading-[var(--text-h1-mobile--line-height)] md:text-[3.25rem] md:leading-[3.5rem]">
            Cette page n&apos;existe pas.
          </h1>
          <p className="mt-6 max-w-[58ch] text-[length:var(--text-grand)] leading-[var(--text-grand--line-height)] text-[color:var(--color-encre-faible)]">
            L&apos;adresse est probablement incorrecte, ou la page a changé de
            nom.
          </p>
          <p className="mt-4 max-w-[58ch] text-[color:var(--color-encre-faible)]">
            Si vous cherchez vos cours ou vos devoirs, passez par{" "}
            <Link href="/connexion" className="text-[color:var(--color-accent)]">
              la connexion
            </Link>
            .
          </p>

          <nav aria-label="Pages du site" className="mt-10">
            <ul className="m-0 flex list-none flex-wrap gap-3 p-0">
              {PISTES.map(([href, libelle]) => (
                <li key={href}>
                  <Link href={href} className="bouton bouton-secondaire">
                    {libelle}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </main>
      <PiedDePage />
    </div>
  );
}
