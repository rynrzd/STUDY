import Link from "next/link";
import { SearchX } from "lucide-react";
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
        <div className="contenu py-16 md:py-24">
          <span className="grid h-12 w-12 place-items-center rounded-[14px] bg-[color:var(--color-rose-clair)] text-[color:var(--color-accent)]" aria-hidden="true">
            <SearchX size={26} strokeWidth={1.75} />
          </span>
          <p className="surtitre m-0 mt-6">Erreur 404</p>
          <h1 className="m-0 mt-3 max-w-[20ch] text-[length:var(--text-h1-etroit)] font-extrabold leading-[var(--text-h1-etroit--line-height)] tracking-[-0.045em] min-[390px]:text-[length:var(--text-h1-mobile)] md:text-[3.25rem] md:leading-[3.5rem]">
            Cette page est introuvable.
          </h1>
          <p className="m-0 mt-5 max-w-[58ch] text-[1.125rem] leading-[1.7] text-[color:var(--color-encre-faible)]">
            L&apos;adresse est probablement incorrecte, ou la page a changé de nom. Tes cours et ton travail se trouvent après la connexion.
          </p>
          <div className="mt-8 flex flex-wrap gap-3">
            <Link href="/" className="bouton bouton-primaire bouton-grand">
              Retour à l&apos;accueil
            </Link>
            <Link href="/connexion" className="bouton bouton-secondaire bouton-grand">
              Se connecter
            </Link>
          </div>
          <nav aria-label="Autres pages du site" className="mt-10">
            <ul className="m-0 flex list-none flex-wrap gap-x-6 gap-y-1 p-0">
              {PISTES.filter(([href]) => href !== "/").map(([href, libelle]) => (
                <li key={href}>
                  <Link href={href} className="inline-flex min-h-[44px] items-center font-semibold text-[color:var(--color-accent)]">
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
