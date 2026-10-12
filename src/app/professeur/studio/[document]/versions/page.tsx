import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { jetonAccesDe, sessionCourante } from "@/lib/session-serveur";
import { document as lireDocument, historique } from "@/lib/studio-documents";
import { VueVersions } from "./vue";

export const metadata: Metadata = { title: "Versions" };

/**
 * Historique des versions d'un document — cahier des charges ch. 12 (EDIT-09).
 * La base ne rend l'historique qu'à l'auteur du document.
 */
export const dynamic = "force-dynamic";

export default async function PageVersions({ params }: { params: Promise<{ document: string }> }) {
  const personne = await sessionCourante();
  if (personne === null) redirect("/connexion");
  const jeton = await jetonAccesDe(personne);
  if (jeton === null) redirect("/connexion");

  const { document: id } = await params;
  const [doc, versions] = await Promise.all([lireDocument(jeton, id), historique(personne.profileId, id)]);
  if (doc === null || versions === null) notFound();

  return <VueVersions document={id} titre={doc.titre} versions={versions} />;
}
