import Link from "next/link";
import { IDENTITE, MARQUE } from "@/lib/identite-legale";

/**
 * Pied de page du site public — L09.
 *
 * Compact et blanc : la marque, puis les liens qu'on vient réellement y
 * chercher. Le cahier « Refonte fidèle » demande explicitement de ne plus
 * étaler en vitrine la liste des détails d'implémentation — SIREN, adresse,
 * hébergeur, directeur de publication. Ces informations restent obligatoires,
 * et elles restent accessibles : elles vivent sur /mentions-legales, à un clic.
 *
 * Rien n'est inventé ici. Ce qui n'est pas encore déposé n'apparaît pas.
 */

const LIENS: readonly (readonly [string, string])[] = [
  ["/connexion", "Connexion"],
  ["/contact", "Contact"],
  ["/confidentialite", "Confidentialité"],
  ["/mentions-legales", "Mentions légales"],
  ["/conditions", "Conditions"],
  ["/accessibilite", "Accessibilité"],
];

export function PiedDePage() {
  return (
    <footer className="border-t border-[color:var(--color-bordure)] bg-[color:var(--color-surface)]">
      <div className="contenu-site flex flex-wrap items-center justify-between gap-x-8 gap-y-5 py-8">
        <Link href="/" className="marque text-[1.25rem] no-underline">
          {MARQUE}.
        </Link>

        <nav aria-label="Liens de pied de page">
          <ul className="m-0 flex list-none flex-wrap gap-x-6 gap-y-2 p-0">
            {LIENS.map(([href, libelle]) => (
              <li key={href}>
                <Link
                  href={href}
                  className="text-[length:var(--text-tableau)] text-[color:var(--color-encre-faible)] no-underline transition-colors duration-[120ms] hover:text-[color:var(--color-encre)]"
                >
                  {libelle}
                </Link>
              </li>
            ))}
          </ul>
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
