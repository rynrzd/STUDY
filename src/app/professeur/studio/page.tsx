import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { jetonAccesDe, sessionCourante } from "@/lib/session-serveur";
import { mesDocuments } from "@/lib/studio-documents";
import { VueStudioDocuments } from "./vue";

export const metadata: Metadata = { title: "Studio" };

/**
 * T02 (documents) — Studio d'import (R2). Le dépôt d'abord, la liste
 * ensuite : ce que le professeur vient faire, c'est importer. La liste vide
 * n'affiche aucun exemple — un faux cours dans une liste de vrais cours est
 * une confusion garantie le jour où l'on cherche vite.
 */
export const dynamic = "force-dynamic";

export default async function PageStudioDocuments() {
  const personne = await sessionCourante();
  if (personne === null) redirect("/connexion");

  const jeton = await jetonAccesDe(personne);
  if (jeton === null) redirect("/connexion");

  const documents = await mesDocuments(jeton);

  return <VueStudioDocuments documents={documents} />;
}
