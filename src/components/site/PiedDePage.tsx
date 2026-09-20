import Link from "next/link";
import { IDENTITE, MARQUE } from "@/lib/identite-legale";

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
      ["/connexion", "Connexion"],
    ],
  },
];

export function PiedDePage() {
  return (
    <footer className="border-t border-[color:var(--color-bordure)] bg-[color:var(--color-surface)]">
      <div className="contenu-site flex flex-wrap items-start justify-between gap-x-8 gap-y-8 py-10">
        {/* La marque et les liens du pied se touchent au pouce, en bas de
            page, souvent d'une seule main : ils ont la hauteur d'une cible
            (V5 §11). L'espacement vertical de la liste suit, sans quoi deux
            liens voisins se chevaucheraient au doigt. */}
        <Link
          href="/"
          className="marque inline-flex min-h-[var(--spacing-cible)] items-center text-[1.25rem] no-underline"
        >
          {MARQUE}.
        </Link>

        <nav
          aria-label="Liens de pied de page"
          className="grid w-full gap-x-10 gap-y-6 sm:w-auto sm:grid-cols-3"
        >
          {GROUPES.map((groupe) => (
            <div key={groupe.titre}>
              {/* Une étiquette, pas un titre de document : trois H2 de plus
                  par page fausseraient le plan de lecture d un lecteur
                  d écran. La liste est nommée par elle. */}
              <p
                id={`pied-${groupe.titre}`}
                className="m-0 text-[length:var(--text-aide)] font-semibold uppercase tracking-[0.08em] text-[color:var(--color-encre-tres-faible)]"
              >
                {groupe.titre}
              </p>
              <ul aria-labelledby={`pied-${groupe.titre}`} className="m-0 mt-1 list-none p-0">
                {groupe.liens.map(([href, libelle]) => (
                  <li key={href}>
                    <Link
                      href={href}
                      className="inline-flex min-h-[var(--spacing-cible)] items-center text-[length:var(--text-tableau)] text-[color:var(--color-encre-faible)] no-underline transition-colors duration-[120ms] hover:text-[color:var(--color-encre)]"
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
        <p className="m-0 text-[length:var(--text-aide)] text-[color:var(--color-encre-tres-faible)]">
          {IDENTITE.editeur} — {IDENTITE.formeJuridique}. Plateforme pédagogique
          d&apos;établissement.{" "}
          Financée par l&apos;établissement, sans publicité ni achat par les
          familles.
        </p>
      </div>
    </footer>
  );
}
