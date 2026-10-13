import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { classes, contexte, ficheProfesseur, groupes, matieres } from "@/lib/etablissement";
import { sessionCourante } from "@/lib/session-serveur";
import { VueFicheProfesseur } from "./vue";

export const metadata: Metadata = { title: "Fiche professeur" };

/**
 * Fiche professeur — cahier des charges ch. 08 (PROF-07). Tout passe par
 * `study.etab_fiche_professeur`, qui recalcule l'établissement : un
 * professeur d'un autre lycée mène à une page introuvable.
 */
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function PageFicheProfesseur({ params }: { params: Promise<{ professeur: string }> }) {
  const personne = await sessionCourante();
  if (personne === null) redirect("/connexion");
  if ((await contexte(personne.profileId)) === null) redirect("/admin");

  const { professeur } = await params;
  if (!UUID.test(professeur)) notFound();

  const [fiche, listeClasses, listeGroupes, listeMatieres] = await Promise.all([
    ficheProfesseur(personne.profileId, professeur),
    classes(personne.profileId),
    groupes(personne.profileId),
    matieres(personne.profileId),
  ]);
  if (fiche === null) notFound();

  return (
    <VueFicheProfesseur
      professeur={professeur}
      fiche={fiche}
      classes={listeClasses.map((c) => ({ id: c.id, label: c.label }))}
      groupes={listeGroupes.map((g) => ({ id: g.id, label: g.label }))}
      matieres={listeMatieres.map((m) => ({ id: m.id, label: m.label }))}
    />
  );
}
