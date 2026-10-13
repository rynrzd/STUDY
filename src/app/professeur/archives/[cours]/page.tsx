import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { archiveCours } from "@/lib/archives-professeur";
import { jetonAccesDe, sessionCourante } from "@/lib/session-serveur";
import { VueArchiveCours } from "./vue";

export const metadata: Metadata = { title: "Cours archivé" };

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Un cours archivé, en lecture seule. Refus et absence répondent tous deux 404. */
export default async function PageArchiveCours({ params }: { params: Promise<{ cours: string }> }) {
  const personne = await sessionCourante();
  if (personne === null) redirect("/connexion");
  const jeton = await jetonAccesDe(personne);
  if (jeton === null) redirect("/connexion");
  const { cours } = await params;
  if (!UUID.test(cours)) notFound();
  const archive = await archiveCours(jeton, cours);
  if (archive === null) notFound();
  return <VueArchiveCours archive={archive} />;
}
