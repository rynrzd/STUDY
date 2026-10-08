import Link from "next/link";
import { redirect } from "next/navigation";
import { BookOpen } from "lucide-react";
import { EnTetePage, EtatVide } from "@/components/study/ui";
import { jetonAccesDe, sessionCourante } from "@/lib/session-serveur";
import { chapitresDuCours, coursDuProfesseur, seancesDuCours } from "@/lib/studio";
import { VueStudio } from "./vue";

/**
 * T02 — Studio (R2) : les cours en pilules, les chapitres en listes de lignes
 * (brouillon ou publiée, toujours écrit), la création de chapitre en encadré.
 * Le premier cours est sélectionné d'office : un professeur qui prépare son
 * cours de 10 h ne devrait pas avoir à naviguer pour l'atteindre.
 */
export const dynamic = "force-dynamic";

export default async function PageStudio({
  searchParams,
}: {
  searchParams: Promise<{ cours?: string }>;
}) {
  const personne = await sessionCourante();
  if (personne === null) redirect("/connexion");

  const jeton = await jetonAccesDe(personne);
  const cours = jeton === null ? [] : await coursDuProfesseur(jeton);

  if (cours.length === 0) {
    return (
      <>
        <EnTetePage sourcil="Studio" titre="Préparer mes cours" />
        <EtatVide
          icone={BookOpen}
          titre="Aucun cours ne vous est affecté."
          texte="Le Studio s'ouvre sur les classes et matières que l'administration de votre établissement vous a attribuées. Si cette liste est vide, c'est que l'affectation n'a pas encore été faite."
          action={
            <Link href="/professeur" className="bouton bouton-secondaire">
              Retour à l&apos;accueil
            </Link>
          }
        />
      </>
    );
  }

  const parametres = await searchParams;
  const choisi = cours.find((c) => c.id === parametres.cours) ?? cours[0]!;

  const [chapitres, seances] = await Promise.all([chapitresDuCours(jeton!, choisi.id), seancesDuCours(jeton!, choisi.id)]);

  const sansChapitre = seances.filter((seance) => seance.chapter_id === null);
  const brouillons = seances.filter((s) => s.state !== "publiee").length;

  return <VueStudio cours={cours} choisi={choisi} chapitres={chapitres} seances={seances} sansChapitre={sansChapitre} brouillons={brouillons} />;
}
