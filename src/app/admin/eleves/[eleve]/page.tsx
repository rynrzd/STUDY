import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { classes, contexte, ficheEleve } from "@/lib/etablissement";
import { sessionCourante } from "@/lib/session-serveur";
import { VueFicheEleve } from "./vue";

export const metadata: Metadata = { title: "Fiche élève" };

/**
 * Fiche élève — cahier des charges, ch. 09.
 *
 * Tout passe par `study.etab_fiche_eleve`, qui recalcule l'établissement depuis
 * l'adhésion de l'administrateur : un identifiant d'élève d'un autre lycée
 * mène à une page introuvable, pas à une fiche.
 */
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export default async function PageFicheEleve({ params }: { params: Promise<{ eleve: string }> }) {
  const personne = await sessionCourante();
  if (personne === null) redirect("/connexion");

  const situation = await contexte(personne.profileId);
  if (situation === null) redirect("/admin");

  const { eleve } = await params;
  if (!UUID.test(eleve)) notFound();

  const [fiche, listeClasses] = await Promise.all([ficheEleve(personne.profileId, eleve), classes(personne.profileId)]);
  if (fiche === null) notFound();

  return (
    <VueFicheEleve
      eleve={eleve}
      fiche={fiche}
      classes={listeClasses.map((c) => ({ id: c.id, label: c.label }))}
      codeEtablissement={situation.publicCode}
    />
  );
}
