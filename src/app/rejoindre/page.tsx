import type { Metadata } from "next";
import Link from "next/link";
import { AvisVisibilite } from "@/components/study/ui";
import { CarteAcces } from "@/components/study/CarteAcces";
import { pagePrivee } from "@/lib/metadonnees";
import { sessionCourante } from "@/lib/session-serveur";
import { FormulaireRejoindre } from "./FormulaireRejoindre";

export const metadata: Metadata = pagePrivee({ titre: "Rejoindre une classe", description: "Demander à rejoindre une classe avec un code." });
export const dynamic = "force-dynamic";

/**
 * E32 — Rejoindre une classe. Le code se saisit une fois connecté ; il
 * transforme une invitation en **demande** que la classe valide. Vérifier un
 * code ne donne accès à rien, et ne montre aucun membre.
 */
export default async function PageRejoindre({ searchParams }: { searchParams: Promise<{ code?: string }> }) {
  const personne = await sessionCourante();
  const { code } = await searchParams;
  const codePropre = typeof code === "string" ? code.toUpperCase().replace(/[^A-Z0-9]/gu, "").slice(0, 10) : undefined;

  if (personne === null) {
    const suite = `/rejoindre${codePropre ? `?code=${codePropre}` : ""}`;
    return (
      <CarteAcces titre="Rejoindre une classe" sousTitre="Connectez-vous d'abord : un code de classe ne remplace pas votre compte.">
        <p className="m-0">
          Votre établissement vous a remis un code établissement, un identifiant et un mot de passe, ou un lien d&apos;invitation.
          Une fois connecté, saisissez le code de classe : votre demande partira vers la classe.
        </p>
        <Link href={`/connexion?suite=${encodeURIComponent(suite)}`} className="bouton bouton-primaire mt-6 w-full">
          Se connecter pour continuer
        </Link>
      </CarteAcces>
    );
  }

  return (
    <CarteAcces
      titre="Rejoindre une classe"
      sousTitre="Saisissez le code que vous avez reçu. Votre demande sera validée par la classe."
      retour={{ href: "/app", libelle: "Retour à mon espace" }}
    >
      <div className="mb-5">
        <AvisVisibilite>
          Le code ne donne pas accès à la classe : il envoie une demande à votre professeur principal ou à la vie scolaire.
          Tant qu&apos;elle n&apos;est pas acceptée, vous ne voyez ni cours ni membres, et la classe ne voit que votre nom.
        </AvisVisibilite>
      </div>
      <FormulaireRejoindre codeInitial={codePropre} />
    </CarteAcces>
  );
}
