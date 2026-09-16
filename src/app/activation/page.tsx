import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { FormulaireActivation } from "@/components/site/FormulaireActivation";
import { MARQUE } from "@/lib/identite-legale";
import { destinationApresConnexion, sessionCourante } from "@/lib/session-serveur";

export const metadata: Metadata = {
  title: "Choisir votre mot de passe",
  robots: { index: false, follow: false },
};

/**
 * Activation du compte.
 *
 * Écran obligatoire à la première connexion. Il n'est pas contournable : une
 * session d'activation n'ouvre aucune donnée pédagogique, et cette garantie
 * est tenue par les politiques de la base, pas par cette page.
 */
export const dynamic = "force-dynamic";

export default async function PageActivation() {
  const personne = await sessionCourante();
  if (personne === null) redirect("/connexion");

  // Un compte déjà activé n'a rien à faire ici.
  if (!personne.activationRequise) redirect(destinationApresConnexion(personne));

  return (
    <main
      id="contenu"
      className="sans-debordement mx-auto flex min-h-dvh w-full max-w-[480px] flex-col justify-center px-5 py-12"
    >
      <p className="m-0 text-[1.5rem] font-extrabold tracking-[-0.03em]">{MARQUE}</p>

      <h1 className="mt-10 text-[length:var(--text-h2)] leading-[var(--text-h2--line-height)]">
        Choisissez votre mot de passe
      </h1>
      <p className="mt-3 text-[color:var(--color-encre-faible)]">
        Bonjour {personne.prenom}. Le mot de passe qui vous a été remis est
        temporaire : il ne donne accès à rien d&apos;autre que cet écran.
        Choisissez-en un personnel pour continuer.
      </p>

      <FormulaireActivation />

      <p className="mt-8 text-[length:var(--text-aide)] leading-[var(--text-aide--line-height)] text-[color:var(--color-encre-faible)]">
        Ne réutilisez pas le mot de passe d&apos;un autre service. Personne, pas
        même l&apos;administrateur de votre établissement, ne peut lire celui
        que vous choisissez ici.
      </p>
    </main>
  );
}
