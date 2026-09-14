import Link from "next/link";
import { EntetePublic, PiedDePage, LARGEUR } from "@/components/public/Chrome";

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
  ["/fonctionnalites", "Fonctionnalités"],
  ["/etablissements", "Pour les établissements"],
  ["/offre", "Offre"],
  ["/aide", "Aide"],
] as const;

export default function Introuvable() {
  return (
    <>
      <EntetePublic />
      <main id="contenu" className={LARGEUR}>
        <div className="py-16 md:py-24">
          <p className="mb-3 text-[color:var(--color-encre-faible)]">Erreur 404</p>
          <h1 className="max-w-[18ch] text-[length:var(--text-h1-public-mobile)] leading-[var(--text-h1-public-mobile--line-height)] md:text-[length:var(--text-h1-public)] md:leading-[var(--text-h1-public--line-height)]">
            Cette page n&apos;existe pas.
          </h1>
          <p className="mt-6 max-w-[62ch] text-[color:var(--color-encre-faible)]">
            Soit l&apos;adresse est incorrecte, soit la page n&apos;a pas encore
            été construite : study. est en cours de réalisation, et plusieurs
            sections annoncées ne sont pas livrées.
          </p>
          <p className="mt-4 max-w-[62ch] text-[color:var(--color-encre-faible)]">
            Si vous cherchez vos cours ou vos devoirs, passez par{" "}
            <Link href="/connexion" className="text-[color:var(--color-accent)]">
              la connexion
            </Link>
            .
          </p>

          <nav aria-label="Pages disponibles" className="mt-10">
            <h2 className="text-[length:var(--text-h2-app)] leading-[var(--text-h2-app--line-height)]">
              Pages disponibles
            </h2>
            <ul className="mt-4 flex list-none flex-wrap gap-3 p-0">
              {PISTES.map(([href, libelle]) => (
                <li key={href}>
                  <Link
                    href={href}
                    className="inline-flex min-h-[44px] items-center rounded-[var(--radius-champ)] border border-[color:var(--color-bordure)] bg-[color:var(--color-surface)] px-4 no-underline text-[color:var(--color-encre)]"
                  >
                    {libelle}
                  </Link>
                </li>
              ))}
            </ul>
          </nav>
        </div>
      </main>
      <PiedDePage />
    </>
  );
}
