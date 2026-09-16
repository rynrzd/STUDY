import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { seDeconnecter } from "@/app/deconnexion/actions";
import { MARQUE } from "@/lib/identite-legale";
import { sessionCourante } from "@/lib/session-serveur";

export const metadata: Metadata = {
  title: "Administration de l'établissement",
  robots: { index: false, follow: false },
};

/**
 * Espace d'administration d'un lycée.
 *
 * Réservé au rôle `admin_etablissement`. Comme pour l'exploitation, le contrôle
 * est doublé en base : les fonctions `study.etab_*` recalculent l'établissement
 * à partir de l'adhésion de l'appelant et refusent tout le reste.
 */
export const dynamic = "force-dynamic";

const ONGLETS = [
  { href: "/etablissement", libelle: "Vue d'ensemble" },
  { href: "/etablissement/import", libelle: "Import de rentrée" },
] as const;

export default async function GabaritEtablissement({
  children,
}: {
  children: React.ReactNode;
}) {
  const personne = await sessionCourante();
  if (personne === null) redirect("/connexion");
  if (personne.activationRequise) redirect("/activation");
  if (!personne.roles.includes("admin_etablissement")) redirect("/connexion");

  return (
    <div className="sans-debordement min-h-screen bg-[color:var(--color-fond)]">
      <header className="border-b border-[color:var(--color-bordure)] bg-[color:var(--color-surface)] print:hidden">
        <div className="mx-auto flex h-[64px] w-full max-w-[var(--spacing-app)] items-center justify-between gap-4 px-5">
          <div className="flex items-baseline gap-3">
            <Link href="/etablissement" className="text-[1.125rem] font-extrabold tracking-[-0.03em] no-underline">
              {MARQUE}
            </Link>
            <span className="hidden text-[length:var(--text-tableau)] text-[color:var(--color-encre-faible)] sm:inline">
              {personne.organisation ?? "Établissement"}
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

        <nav aria-label="Sections" className="border-t border-[color:var(--color-bordure)]">
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
