import Link from "next/link";
import { redirect } from "next/navigation";
import { BookOpen } from "lucide-react";
import { RubriqueCours } from "@/components/study/Rubriques";
import { EnTetePage, EtatVide } from "@/components/study/ui";
import { jetonAccesDe, sessionCourante } from "@/lib/session-serveur";
import { chapitresArchives, chapitresDuCours, coursDuProfesseur, coursFavoris, seancesDuCours, statistiquesCours } from "@/lib/studio";
import { coursArchives } from "@/lib/archives-professeur";
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
  searchParams: Promise<{ cours?: string; q?: string; etat?: string }>;
}) {
  const personne = await sessionCourante();
  if (personne === null) redirect("/connexion");

  const jeton = await jetonAccesDe(personne);
  const cours = jeton === null ? [] : await coursDuProfesseur(jeton);

  if (cours.length === 0) {
    return (
      <>
        <RubriqueCours actif="/studio" />
        <EnTetePage sourcil="Mes cours" titre="Préparer mes séances" />
        <EtatVide
          icone={BookOpen}
          titre="Aucun cours ne vous est affecté."
          texte="« Mes cours » s'ouvre sur les classes et matières que l'administration de votre établissement vous a attribuées. Si cette liste est vide, c'est que l'affectation n'a pas encore été faite."
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

  const [chapitres, seances, archives, favoris, passes, statistiques] = await Promise.all([
    chapitresDuCours(jeton!, choisi.id),
    seancesDuCours(jeton!, choisi.id),
    chapitresArchives(jeton!, choisi.id),
    coursFavoris(jeton!),
    coursArchives(jeton!),
    statistiquesCours(jeton!, choisi.id),
  ]);
  const sourcesCopie = [
    ...cours.filter((c) => c.id !== choisi.id).map((c) => ({ id: c.id, libelle: c.libelle })),
    ...(passes ?? []).map((c) => ({ id: c.espace, libelle: `${c.matiere} — ${c.cible} (${c.annee})` })),
  ];

  // TEACH-13 : chercher une séance par titre, filtrer par état.
  const recherche = {
    q: (parametres.q ?? "").trim().slice(0, 80),
    etat: ["brouillon", "programmee", "publiee"].includes(parametres.etat ?? "") ? (parametres.etat as string) : "",
  };
  const plat = (v: string) => v.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const filtrees = seances.filter((s) => (!recherche.q || plat(s.title).includes(plat(recherche.q))) && (!recherche.etat || s.state === recherche.etat));
  const sansChapitre = filtrees.filter((seance) => seance.chapter_id === null);
  const brouillons = seances.filter((s) => s.state !== "publiee").length;

  return <VueStudio cours={cours} choisi={choisi} chapitres={chapitres} seances={filtrees} sansChapitre={sansChapitre} recherche={recherche} total={seances.length} brouillons={brouillons} archives={archives} favoris={[...favoris]} sourcesCopie={sourcesCopie} statistiques={statistiques} />;
}
