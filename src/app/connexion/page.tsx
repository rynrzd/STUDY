import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { FormulaireConnexion } from "@/components/site/FormulaireConnexion";
import { MARQUE } from "@/lib/identite-legale";
import { destinationApresConnexion, sessionCourante } from "@/lib/session-serveur";

export const metadata: Metadata = {
  title: "Connexion",
  description: "Entrée réservée aux membres d'un établissement équipé.",
  robots: { index: false, follow: false },
};

/**
 * /connexion — C01.
 *
 * Deux panneaux sur ordinateur : le rose porte la marque et une phrase, le
 * blanc porte le formulaire. Sur téléphone, une seule colonne et un en-tête
 * réduit — le panneau rose disparaît plutôt que de pousser les champs sous la
 * ligne de flottaison.
 *
 * Il n'y a pas d'inscription : un compte est créé par l'établissement. Rien ici
 * ne doit ressembler à une page d'inscription grand public, ni proposer une
 * connexion par un compte tiers.
 */
export const dynamic = "force-dynamic";

export default async function PageConnexion({
  searchParams,
}: {
  searchParams: Promise<{ fin?: string }>;
}) {
  const personne = await sessionCourante();
  if (personne !== null) redirect(destinationApresConnexion(personne));

  const parametres = await searchParams;
  const deconnexionConfirmee = parametres.fin === "1";

  return (
    <div className="sans-debordement grid min-h-dvh lg:grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)]">
      {/* Panneau rose : présent seulement là où il a la place d'exister. */}
      <aside className="hidden flex-col justify-between bg-[color:var(--color-rose-clair)] p-12 lg:flex">
        <Link href="/" className="marque text-[1.5rem] no-underline">
          {MARQUE}.
        </Link>

        <p className="m-0 max-w-[14ch] text-[length:var(--text-h2-large)] leading-[var(--text-h2-large--line-height)] tracking-[-0.02em]">
          Retrouvez votre classe.
        </p>

        <p className="m-0 max-w-[40ch] text-[length:var(--text-tableau)] leading-[var(--text-tableau--line-height)] text-[color:var(--color-encre-faible)]">
          Le cours, les devoirs et l&apos;entraide, au même endroit.
        </p>
      </aside>

      <main
        id="contenu"
        className="flex flex-col justify-center bg-[color:var(--color-surface)] px-5 py-12 sm:px-8"
      >
        <div className="mx-auto w-full max-w-[420px]">
          <Link href="/" className="marque text-[1.375rem] no-underline lg:hidden">
            {MARQUE}.
          </Link>

          <h1 className="mt-8 text-[length:var(--text-h2)] leading-[var(--text-h2--line-height)] tracking-[-0.02em] lg:mt-0">
            Se connecter
          </h1>
          <p className="mt-3 text-[length:var(--text-tableau)] leading-[var(--text-tableau--line-height)] text-[color:var(--color-encre-faible)]">
            Votre établissement vous a remis un code, un identifiant et un mot de
            passe.
          </p>

          {deconnexionConfirmee ? (
            <p
              role="status"
              className="m-0 mt-6 rounded-[var(--radius-carte)] border border-[color:var(--color-bordure)] bg-[color:var(--color-succes-fond)] p-4 text-[length:var(--text-tableau)] leading-[var(--text-tableau--line-height)] text-[color:var(--color-succes)]"
            >
              Vous êtes déconnecté. Sur un poste partagé, fermez aussi le
              navigateur.
            </p>
          ) : null}

          <FormulaireConnexion />

          <div className="mt-8 border-t border-[color:var(--color-bordure)] pt-6">
            <p className="m-0 text-[length:var(--text-tableau)] leading-[var(--text-tableau--line-height)] text-[color:var(--color-encre-faible)]">
              <Link
                href="/mot-de-passe-oublie"
                className="font-semibold text-[color:var(--color-accent)]"
              >
                Besoin d&apos;aide ?
              </Link>{" "}
              L&apos;administration de votre établissement réinitialise votre
              accès après avoir vérifié votre identité. Personne ne peut lire
              votre mot de passe.
            </p>
          </div>

          <p className="mt-8 text-[length:var(--text-aide)]">
            <Link href="/" className="text-[color:var(--color-encre-faible)]">
              ← Retour au site
            </Link>
          </p>
        </div>
      </main>
    </div>
  );
}
