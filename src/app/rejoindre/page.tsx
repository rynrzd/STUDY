import { CadreAccesPublic } from "@/components/site/CadreAccesPublic";
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
export default async function PageRejoindre({ searchParams }: { searchParams: Promise<{ code?: string; envoyee?: string }> }) {
  const personne = await sessionCourante();
  const { code, envoyee } = await searchParams;
  const codePropre = typeof code === "string" ? code.toUpperCase().replace(/[^A-Z0-9]/gu, "").slice(0, 10) : undefined;

  if (personne === null) {
    const suite = `/rejoindre${codePropre ? `?code=${codePropre}` : ""}`;
    return (
      <CadreAccesPublic titre="Rejoindre une classe" sousTitre="Connectez-vous d'abord : un code de classe ne remplace pas votre compte.">
        <p className="m-0">Connecte-toi avec ton compte. Le code de classe enverra une demande au responsable sans donner accès aux membres ni aux cours.</p>
        <Link href={`/connexion?suite=${encodeURIComponent(suite)}`} className="bouton bouton-primaire mt-6 w-full">
          Se connecter pour continuer
        </Link>
      </CadreAccesPublic>
    );
  }

  return (
    <CarteAcces
      titre="Rejoindre une classe"
      sousTitre="Saisissez le code que vous avez reçu. Votre demande sera validée par la classe."
      retour={{ href: "/app", libelle: "Retour à mon espace" }}
    >
      <div className="mb-5">
        {envoyee === "1" ? <p role="status" className="mb-4 rounded-[4px] bg-[color:var(--color-succes-fond)] p-4 text-[color:var(--color-succes)]">Demande envoyée. Le responsable de la classe doit maintenant l’approuver.</p> : null}
        <AvisVisibilite>
          Le code ne donne pas accès à la classe : il envoie une demande au responsable de la classe.
          Tant qu&apos;elle n&apos;est pas acceptée, vous ne voyez ni cours ni membres, et la classe ne voit que votre nom.
        </AvisVisibilite>
      </div>
      {envoyee === "1" ? <Link href="/professeur/classes" className="bouton bouton-primaire">Retour à mes classes</Link> : <FormulaireRejoindre codeInitial={codePropre} professeur={personne.roles.includes("professeur")} />}
    </CarteAcces>
  );
}
