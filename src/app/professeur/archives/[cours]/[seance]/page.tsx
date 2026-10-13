import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { Archive } from "lucide-react";
import { Dupliquer } from "@/components/studio/Dupliquer";
import { VueSeance } from "@/components/seance/VueSeance";
import { EnTetePage, Encadre } from "@/components/study/ui";
import { archiveCours, archiveSeance } from "@/lib/archives-professeur";
import { jetonAccesDe, sessionCourante } from "@/lib/session-serveur";
import { coursDuProfesseur } from "@/lib/studio";

export const metadata: Metadata = { title: "Séance archivée" };

export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/**
 * Une séance d'un cours archivé : relue telle que la classe la voyait, et
 * réutilisable cette année (YR-07). La recopie passe par
 * `studio_dupliquer_seance` : un brouillon, sans devoir, dans un cours actif
 * que le professeur enseigne.
 */
export default async function PageArchiveSeance({ params }: { params: Promise<{ cours: string; seance: string }> }) {
  const personne = await sessionCourante();
  if (personne === null) redirect("/connexion");
  const jeton = await jetonAccesDe(personne);
  if (jeton === null) redirect("/connexion");
  const { cours, seance } = await params;
  if (!UUID.test(cours) || !UUID.test(seance)) notFound();

  const [lecture, archive, actuels] = await Promise.all([archiveSeance(jeton, seance), archiveCours(jeton, cours), coursDuProfesseur(jeton)]);
  if (lecture === null || archive === null || lecture.seance.teaching_space_id !== cours) notFound();

  const libelle = `${archive.cours.matiere} — ${archive.cours.cible}`;
  // Les documents joints restent conservés ; leur téléchargement suit les
  // droits du cours, archivé ici. Ils sont nommés, sans lien : réutiliser la
  // séance les rend de nouveau consultables dans le cours de cette année.
  const blocs = lecture.blocs.map((b) => ({ ...b, file_id: null, assignment_id: null }));

  return (
    <div className="mx-auto max-w-[860px]">
      <EnTetePage
        filAriane={[
          { href: "/professeur/archives", libelle: "Années passées" },
          { href: `/professeur/archives/${cours}`, libelle: `${libelle} (${archive.cours.annee})` },
        ]}
        sourcil={`${archive.cours.annee} · Année archivée`}
        titre={lecture.seance.title}
      />
      <Encadre icone={Archive} titre="Lecture seule.">
        Cette séance appartient à un cours archivé : elle ne se modifie plus. « Réutiliser » en fait une copie en brouillon dans un de vos cours de
        cette année, sans devoir ni copie d&apos;élève.
      </Encadre>
      <div className="mt-4">
        <Dupliquer seance={seance} titre={lecture.seance.title} cours={actuels.map((c) => ({ id: c.id, libelle: c.libelle }))} coursActuel={cours} libelle="Réutiliser cette année" />
      </div>
      <div className="panneau mt-6">
        <VueSeance seance={lecture.seance} blocs={blocs} libelleCours={libelle} chapitre={lecture.chapitre} sansEntete />
      </div>
    </div>
  );
}
