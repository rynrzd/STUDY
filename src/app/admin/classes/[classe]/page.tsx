import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { contexte, ficheClasse, tousLesMembres } from "@/lib/etablissement";
import { sessionCourante } from "@/lib/session-serveur";
import { VueFicheClasse } from "./vue";

export const metadata: Metadata = { title: "Fiche classe" };

/**
 * Fiche classe — cahier des charges ch. 06 (CL-03, CL-04). Tout passe par
 * `study.etab_fiche_classe`, qui recalcule l'établissement : une classe d'un
 * autre lycée mène à une page introuvable.
 */
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function PageFicheClasse({ params }: { params: Promise<{ classe: string }> }) {
  const personne = await sessionCourante();
  if (personne === null) redirect("/connexion");
  if ((await contexte(personne.profileId)) === null) redirect("/admin");

  const { classe } = await params;
  if (!UUID.test(classe)) notFound();

  const [fiche, profs] = await Promise.all([ficheClasse(personne.profileId, classe), tousLesMembres(personne.profileId, { role: "professeur" })]);
  if (fiche === null) notFound();

  const professeurs = profs
    .filter((m) => m.roles.includes("professeur"))
    .map((m) => ({ id: m.profile_id, label: `${m.nom} ${m.prenom}` }));
  return <VueFicheClasse fiche={fiche} professeurs={professeurs} />;
}
