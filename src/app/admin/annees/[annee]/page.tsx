import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { anneeArchivee, contexte } from "@/lib/etablissement";
import { sessionCourante } from "@/lib/session-serveur";
import { VueAnneeArchivee } from "./vue";

export const metadata: Metadata = { title: "Année archivée" };

/**
 * Relevé d'une année archivée — cahier des charges ch. 18 (YR-04, YR-09).
 *
 * Lecture seule : `study.etab_annee_archivee` recalcule l'établissement depuis
 * l'adhésion de l'administrateur et refuse une année encore en cours ou d'un
 * autre lycée, qui mènent ici à une page introuvable.
 */
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function PageAnneeArchivee({ params }: { params: Promise<{ annee: string }> }) {
  const personne = await sessionCourante();
  if (personne === null) redirect("/connexion");
  if ((await contexte(personne.profileId)) === null) redirect("/admin");

  const { annee } = await params;
  if (!UUID.test(annee)) notFound();

  const releve = await anneeArchivee(personne.profileId, annee);
  if (releve === null) notFound();
  return <VueAnneeArchivee releve={releve} />;
}
