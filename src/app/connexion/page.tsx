import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { FormulaireConnexion } from "@/components/site/FormulaireConnexion";
import { MARQUE } from "@/lib/identite-legale";
import { destinationApresConnexion, sessionCourante } from "@/lib/session-serveur";

export const metadata: Metadata = {
  title: "Connexion",
  description: "Entrée réservée aux membres d'un établissement équipé.",
  // L'entrée privée n'a rien à faire dans un index (ch. 05).
  robots: { index: false, follow: false },
};

/**
 * /connexion — entrée privée.
 *
 * Trois éléments : code établissement, identifiant, mot de passe. Le code
 * identifie le lycée et n'accorde aucun droit. Il n'y a pas d'inscription
 * publique : un compte est créé par l'établissement, jamais demandé ici.
 *
 * Une personne déjà connectée est renvoyée vers son espace plutôt que de
 * revoir un formulaire de connexion.
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
    <main
      id="contenu"
      className="sans-debordement mx-auto flex min-h-dvh w-full max-w-[480px] flex-col justify-center px-5 py-12"
    >
      <Link href="/" className="text-[1.5rem] font-extrabold tracking-[-0.03em] no-underline">
        {MARQUE}
      </Link>

      <h1 className="mt-10 text-[length:var(--text-h2)] leading-[var(--text-h2--line-height)]">
        Se connecter
      </h1>
      <p className="mt-3 text-[color:var(--color-encre-faible)]">
        Votre établissement vous a remis un code, un identifiant et un mot de
        passe.
      </p>

      {deconnexionConfirmee ? (
        <p
          role="status"
          className="mt-6 m-0 rounded-[var(--radius-carte)] border border-[color:var(--color-bordure)] bg-[color:var(--color-succes-fond)] p-4 text-[length:var(--text-tableau)] leading-[var(--text-tableau--line-height)] text-[color:var(--color-succes)]"
        >
          Vous êtes déconnecté. Sur un poste partagé, fermez aussi le
          navigateur.
        </p>
      ) : null}

      <FormulaireConnexion />

      <div className="mt-10 border-t border-[color:var(--color-bordure)] pt-6 text-[length:var(--text-tableau)] leading-[var(--text-tableau--line-height)] text-[color:var(--color-encre-faible)]">
        <p className="m-0">
          <strong className="text-[color:var(--color-encre)]">
            Mot de passe oublié ?
          </strong>{" "}
          Adressez-vous à l&apos;administrateur de votre établissement. Il
          réinitialise votre accès après avoir vérifié votre identité sur place.
          Personne ne peut lire votre mot de passe : il n&apos;est stocké nulle
          part en clair.
        </p>
        <p className="m-0 mt-4">
          Il n&apos;y a pas d&apos;inscription : les comptes sont créés par
          l&apos;établissement. Si votre lycée n&apos;utilise pas encore{" "}
          {MARQUE},{" "}
          <Link href="/etablissements" className="text-[color:var(--color-accent)]">
            parlez-en à votre direction
          </Link>
          .
        </p>
      </div>

      <p className="mt-8 text-[length:var(--text-aide)]">
        <Link href="/" className="text-[color:var(--color-encre-faible)]">
          ← Retour au site
        </Link>
      </p>
    </main>
  );
}
