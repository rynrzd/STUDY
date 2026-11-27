import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { FileWarning, History } from "lucide-react";
import { FilAriane } from "@/components/study/ui";
import { EditeurDocument } from "@/components/studio/EditeurDocument";
import { LecteurPdf } from "@/components/seance/LecteurPdf";
import { SuiviTraitement } from "@/components/studio/SuiviTraitement";
import { jetonAccesDe, sessionCourante } from "@/lib/session-serveur";
import { document as lireDocument, revision } from "@/lib/studio-documents";
import { clientUtilisateur } from "@/lib/supabase-serveur";

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
  searchParams,
}: {
  params: Promise<{ document: string }>;
  searchParams: Promise<{ deja?: string; vue?: string }>;
}) {
  const personne = await sessionCourante();
  if (personne === null) redirect("/connexion");

  const jeton = await jetonAccesDe(personne);
  if (jeton === null) redirect("/connexion");

  const { document: id } = await params;
  const doc = await lireDocument(jeton, id);
  if (doc === null) notFound();
  const { deja: dejaParam, vue } = await searchParams;

  // L'original est deja disponible apres le transfert. Pas besoin d'attendre
  // l'extraction, qui peut echouer sur un PDF scanne sans couche de texte.
  if (vue === "original" && doc.fichierSourceId) {
    const { data: fichier, error } = await clientUtilisateur(jeton)
      .from("files")
      .select("display_name, mime_detected, state")
      .eq("id", doc.fichierSourceId)
      .maybeSingle();
    if (error || !fichier || fichier.state !== "disponible") notFound();
    const estPdf = fichier.mime_detected === "application/pdf";

    return (
      <div className="mx-auto max-w-[940px]" data-testid="studio-vue-originale">
        <Retour />
        <div className="mt-5 rounded-2xl border border-[color:var(--color-bordure)] bg-[color:var(--color-surface)] p-4 sm:p-7">
          <p className="m-0 text-sm font-semibold text-[color:var(--color-accent)]">Document original conservé</p>
          <h1 className="titre-page m-0 mt-2 break-words">{fichier.display_name}</h1>
          <p className="m-0 mt-3 text-[color:var(--color-encre-faible)]">
            Voici le fichier que tu as déposé, sans modification. Même un PDF scanné reste consultable ici : la reconnaissance de son texte n&apos;est pas nécessaire pour garder l&apos;original.
          </p>
          {doc.etat === "echec" ? (
            <p role="status" className="mt-4 rounded-xl border border-[color:var(--color-bordure)] bg-[color:var(--color-surface-douce)] p-3 text-sm">
              La préparation d&apos;une version modifiable n&apos;a pas abouti : {doc.erreur ?? "document illisible pour l'extraction"}. Cela n&apos;affecte pas ton fichier d&apos;origine.
            </p>
          ) : doc.etat === "traitement" || doc.etat === "importe" ? (
            <p role="status" className="mt-4 text-sm text-[color:var(--color-encre-faible)]">
              Une version modifiable se prépare en arrière-plan. Ton original est déjà disponible.
            </p>
          ) : null}
          <div className="mt-5 flex flex-wrap gap-3">
            <a href={`/documents/${doc.fichierSourceId}`} className="bouton bouton-secondaire">Télécharger mon original</a>
            <Link href={`/professeur/studio/${id}`} className="bouton bouton-primaire">{doc.etat === "echec" ? "Voir les limites de conversion" : "Créer un beau support"}</Link>
          </div>
          {!estPdf ? (
            <p className="m-0 mt-5 rounded-xl bg-[color:var(--color-surface-douce)] p-4 text-sm text-[color:var(--color-encre-faible)]">
              Ce document Word reste intact. Pour voir ses images et sa mise en page d&apos;origine, ouvre-le dans Word ou LibreOffice après téléchargement.
            </p>
          ) : null}
        </div>
        {estPdf ? <div className="mt-6"><LecteurPdf fichier={doc.fichierSourceId} nom={fichier.display_name} /></div> : null}
      </div>
    );
  }

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
          {doc.fichierSourceId ? <a href={`/documents/${doc.fichierSourceId}`} className="bouton bouton-secondaire mt-5 ml-2">Télécharger l’original</a> : null}
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
  const deja = dejaParam === "1";

  return (
    <>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <Retour />
        <Link href={`/professeur/studio/${doc.id}/versions`} className="inline-flex min-h-[44px] items-center gap-1.5 text-[0.875rem] font-semibold text-[color:var(--color-accent)]">
          <History size={16} strokeWidth={1.75} aria-hidden="true" /> Historique des versions
        </Link>
      </div>
      {deja ? (
        <p className="encadre-seance mt-4" role="status">
          Ce fichier était déjà importé : votre document existant est rouvert, sans seconde copie. Ses publications et ses versions restent les mêmes.
        </p>
      ) : null}
      <div className="mt-4">
        <EditeurDocument
          initial={{
            id: doc.id,
            etat: doc.etat,
            revision: courante.numero,
            revisionId: courante.id,
            document: courante.document,
            reglages: courante.reglages,
            fichierSource: doc.fichierSourceId ?? null,
          }}
        />
      </div>
    </>
  );
}

function Retour() {
  return <FilAriane etapes={[{ href: "/studio", libelle: "Mes cours" }, { href: "/professeur/studio", libelle: "Documents importés" }]} />;
}
