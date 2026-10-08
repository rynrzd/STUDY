import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { FileWarning } from "lucide-react";
import { FilAriane } from "@/components/study/ui";
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
        <div className="panneau mt-2 max-w-[720px] text-center">
          <span className="mx-auto mb-4 grid h-12 w-12 place-items-center rounded-full bg-[color:var(--color-erreur-fond)] text-[color:var(--color-erreur)]" aria-hidden="true">
            <FileWarning size={24} strokeWidth={1.75} />
          </span>
          <h1 className="titre-section m-0">
            Ce document n&apos;a pas pu être converti
          </h1>
          <p className="m-0 mt-3">{doc.erreur}</p>
          <p className="meta m-0 mt-4">
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
  return <FilAriane etapes={[{ href: "/professeur/studio", libelle: "Studio" }]} />;
}
