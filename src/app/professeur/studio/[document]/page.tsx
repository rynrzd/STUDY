import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { EditeurDocument } from "@/components/studio/EditeurDocument";
import { SuiviTraitement } from "@/components/studio/SuiviTraitement";
import { jetonAccesDe, sessionCourante } from "@/lib/session-serveur";
import { document as lireDocument, revision } from "@/lib/studio-documents";

export const metadata: Metadata = { title: "Mise en page" };

/**
 * Mise en page d'un document — S07.
 *
 * Trois états possibles, et un écran pour chacun :
 *
 *  - le traitement est en cours → l'avancement, et rien d'autre ;
 *  - il a échoué → la raison, en clair, et le moyen de repartir ;
 *  - il a réussi → l'éditeur.
 *
 * Aucun de ces trois n'est une page blanche avec un tourniquet : quand quelque
 * chose prend du temps ou échoue, le produit doit dire quoi.
 */
export const dynamic = "force-dynamic";

export default async function PageMiseEnPage({
  params,
}: {
  params: Promise<{ document: string }>;
}) {
  const personne = await sessionCourante();
  if (personne === null) redirect("/connexion");

  const jeton = await jetonAccesDe(personne);
  if (jeton === null) redirect("/connexion");

  const { document: id } = await params;
  const doc = await lireDocument(jeton, id);
  if (doc === null) notFound();

  if (doc.etat === "echec") {
    return (
      <>
        <Retour />
        <div className="mt-6 max-w-[var(--spacing-lecture)] rounded-[var(--radius-carte)] border border-[color:var(--color-erreur)] bg-[color:var(--color-erreur-fond)] p-6">
          <h1 className="m-0 text-[length:var(--text-h1-app)] leading-[var(--text-h1-app--line-height)] text-[color:var(--color-erreur)]">
            Ce document n&apos;a pas pu être converti
          </h1>
          <p className="m-0 mt-3">{doc.erreur}</p>
          <p className="m-0 mt-5 text-[length:var(--text-tableau)] text-[color:var(--color-encre-faible)]">
            Le fichier que vous avez déposé est conservé. Vous pouvez corriger le
            document à la source puis le réimporter.
          </p>
          <Link href="/professeur/studio" className="bouton bouton-primaire mt-5">
            Importer un autre document
          </Link>
        </div>
      </>
    );
  }

  if (doc.etat === "importe" || doc.etat === "traitement" || doc.revisionId === null) {
    return (
      <>
        <Retour />
        <SuiviTraitement document={id} titre={doc.titre} />
      </>
    );
  }

  const courante = await revision(jeton, doc.revisionId);
  if (courante === null) notFound();

  return (
    <>
      <Retour />
      <div className="mt-4">
        <EditeurDocument
          initial={{
            id: doc.id,
            etat: doc.etat,
            revision: courante.numero,
            document: courante.document,
            reglages: courante.reglages,
            fichierSource: null,
          }}
        />
      </div>
    </>
  );
}

function Retour() {
  return (
    <p className="m-0">
      <Link
        href="/professeur/studio"
        className="text-[length:var(--text-tableau)] text-[color:var(--color-encre-faible)] no-underline hover:text-[color:var(--color-accent)]"
      >
        ← Studio
      </Link>
    </p>
  );
}
