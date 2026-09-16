import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { seDeconnecter } from "@/app/deconnexion/actions";
import { MARQUE } from "@/lib/identite-legale";
import { estExploitant, sessionCourante } from "@/lib/session-serveur";

export const metadata: Metadata = {
  title: "Administration",
  robots: { index: false, follow: false },
};

/**
 * Espace d'exploitation — réservé au compte propriétaire.
 *
 * Le contrôle est fait ici, sur le gabarit, donc pour toutes les pages de la
 * section. Il est doublé côté base : les fonctions `study.admin_*` revérifient
 * l'habilitation de l'acteur. Un oubli de garde sur une route future ne suffit
 * donc pas à ouvrir l'administration.
 *
 * Une personne non habilitée est renvoyée vers la connexion, pas vers un
 * « accès refusé » : l'existence de cette section ne se confirme pas.
 */
export const dynamic = "force-dynamic";

const ONGLETS = [
  { href: "/administration", libelle: "Demandes" },
  { href: "/administration/etablissements", libelle: "Établissements" },
  { href: "/administration/journal", libelle: "Journal" },
] as const;

export default async function GabaritAdministration({
  children,
}: {
  children: React.ReactNode;
}) {
  const personne = await sessionCourante();
  if (personne === null || !estExploitant(personne)) redirect("/connexion");

  return (
    <div className="sans-debordement min-h-screen bg-[color:var(--color-fond)]">
      <header className="border-b border-[color:var(--color-bordure)] bg-[color:var(--color-surface)]">
        <div className="mx-auto flex h-[64px] w-full max-w-[var(--spacing-app)] items-center justify-between gap-4 px-5">
          <div className="flex items-baseline gap-3">
            <Link href="/administration" className="text-[1.125rem] font-extrabold tracking-[-0.03em] no-underline">
              {MARQUE}
            </Link>
            <span className="text-[length:var(--text-aide)] font-semibold uppercase tracking-[0.08em] text-[color:var(--color-encre-faible)]">
              Exploitation
            </span>
          </div>

          <div className="flex items-center gap-3">
            <span className="hidden text-[length:var(--text-tableau)] text-[color:var(--color-encre-faible)] sm:inline">
              {personne.prenom} {personne.nom}
            </span>
            <form action={seDeconnecter}>
              <button type="submit" className="bouton bouton-secondaire h-9 min-h-9 px-3.5 text-[length:var(--text-tableau)]">
                Se déconnecter
              </button>
            </form>
          </div>
        </div>

        <nav aria-label="Sections de l'administration" className="border-t border-[color:var(--color-bordure)]">
          <ul className="mx-auto m-0 flex w-full max-w-[var(--spacing-app)] list-none gap-6 overflow-x-auto px-5">
            {ONGLETS.map((onglet) => (
              <li key={onglet.href}>
                <Link
                  href={onglet.href}
                  className="inline-flex min-h-[44px] items-center whitespace-nowrap text-[length:var(--text-tableau)] font-medium text-[color:var(--color-encre-faible)] no-underline hover:text-[color:var(--color-encre)]"
                >
                  {onglet.libelle}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </header>

      <main id="contenu" className="mx-auto w-full max-w-[var(--spacing-app)] px-5 py-10">
        {children}
      </main>
    </div>
  );
}
