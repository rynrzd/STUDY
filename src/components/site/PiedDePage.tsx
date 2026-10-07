import Link from "next/link";
import { IDENTITE, MARQUE } from "@/lib/identite-legale";
import { MotSymbole } from "./MotSymbole";

/**
 * Pied de page du site public — L09.
 *
 * Blanc, et organisé : la marque, puis les liens qu'on vient réellement y
 * chercher, groupés par intention.
 *
 * Le cahier « Refonte fidèle » demande explicitement de ne plus
 * étaler en vitrine la liste des détails d'implémentation — SIREN, adresse,
 * hébergeur, directeur de publication. Ces informations restent obligatoires,
 * et elles restent accessibles : elles vivent sur /mentions-legales, à un clic.
 *
 * Rien n'est inventé ici. Ce qui n'est pas encore déposé n'apparaît pas.
 */

/**
 * Les neuf liens du pied de page.
 *
 * Il n'y en avait que trois. C'était un choix défendable pour une vitrine
 * sobre, mais il laissait trois pages publiques — l'offre, la sécurité, les
 * conditions — atteignables uniquement depuis un autre endroit du site, et
 * l'accessibilité nulle part. Un pied de page est aussi la table des matières
 * de ce qu'on publie : ce qui n'y figure pas est difficile à trouver, et pour
 * une page légale c'est un problème.
 *
 * Ils sont groupés par intention plutôt qu'alignés en une file : ce qu'est le
 * produit, ce qu'il engage, comment entrer.
 */
const GROUPES: readonly {
  readonly titre: string;
  readonly liens: readonly (readonly [string, string])[];
}[] = [
  {
    titre: "Le produit",
    liens: [
      ["/produit", "Produit"],
      ["/etablissements", "Pour les établissements"],
      ["/offre", "Offre"],
    ],
  },
  {
    titre: "Confiance",
    liens: [
      ["/securite", "Sécurité et données"],
      ["/confidentialite", "Confidentialité"],
      ["/conditions", "Conditions d'utilisation"],
    ],
  },
  {
    titre: "Nous joindre",
    liens: [
      ["/contact", "Contact"],
      ["/mentions-legales", "Mentions légales"],
      ["/aide", "Aide"],
      ["/connexion", "Connexion"],
    ],
  },
];

export function PiedDePage() {
  return (
    <footer className="border-t border-[color:var(--color-bordure)] bg-[color:var(--color-surface)]">
      <div className="contenu-site grid gap-8 py-12 md:grid-cols-[1.2fr_2fr] md:gap-12">
        <div>
          <Link href="/" className="inline-flex min-h-[var(--spacing-cible)] items-center text-[color:var(--color-encre)] no-underline">
            <MotSymbole titre="Study, accueil" className="block h-auto w-[84px]" />
          </Link>
          <p className="m-0 mt-3 max-w-[34ch] text-[0.9375rem] text-[color:var(--color-encre-faible)]">
            Les cours, le travail à faire et les échanges de la classe, au même endroit.
          </p>
        </div>
        <nav aria-label="Liens de pied de page" className="grid grid-cols-2 gap-x-6 gap-y-6 md:grid-cols-3">
          {GROUPES.map((groupe) => (
            <div key={groupe.titre}>
              <p id={`pied-${groupe.titre}`} className="m-0 text-[0.75rem] font-bold uppercase tracking-[0.1em] text-[color:var(--color-encre-faible)]">
                {groupe.titre}
              </p>
              <ul aria-labelledby={`pied-${groupe.titre}`} className="m-0 mt-1 list-none p-0">
                {groupe.liens.map(([href, libelle]) => (
                  <li key={href}>
                    <Link
                      href={href}
                      className="inline-flex min-h-[var(--spacing-cible)] items-center text-[0.9375rem] text-[color:var(--color-encre)] no-underline transition-colors duration-[120ms] hover:text-[color:var(--color-accent)]"
                    >
                      {libelle}
                    </Link>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </nav>
      </div>
      <div className="contenu-site border-t border-[color:var(--color-bordure)] py-5">
        <p className="m-0 text-[0.8125rem] text-[color:var(--color-encre-faible)]">
          {MARQUE} — {IDENTITE.editeur}, {IDENTITE.formeJuridique}. Plateforme pédagogique d&apos;établissement, financée par l&apos;établissement,
          sans publicité ni achat par les familles.
        </p>
      </div>
    </footer>
  );
}
