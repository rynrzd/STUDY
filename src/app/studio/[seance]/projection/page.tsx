import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { VueSeance } from "@/components/seance/VueSeance";
import { CadreProjection } from "@/components/studio/OutilsApercu";
import { jetonAccesDe, sessionCourante } from "@/lib/session-serveur";
import { seanceComplete } from "@/lib/studio";

export const metadata: Metadata = { title: "Projection" };

/**
 * Projeter une séance en classe — cahier des charges ch. 10 (TEACH-18) :
 * distinct de l'édition, gros caractères et fort contraste. Lecture seule,
 * sous les droits du professeur (séance introuvable sinon).
 */
export const dynamic = "force-dynamic";

export default async function PageProjection({ params }: { params: Promise<{ seance: string }> }) {
  const personne = await sessionCourante();
  if (personne === null) redirect("/connexion");
  const { seance: id } = await params;
  const jeton = await jetonAccesDe(personne);
  if (jeton === null) redirect("/connexion");
  const ensemble = await seanceComplete(jeton, id);
  if (ensemble === null) notFound();

  return (
    <CadreProjection retour={`/studio/${id}/apercu`}>
      <VueSeance seance={ensemble.seance} blocs={ensemble.blocs} libelleCours={ensemble.cours?.libelle ?? "Cours"} chapitre={ensemble.chapitre?.label ?? null} />
    </CadreProjection>
  );
}
