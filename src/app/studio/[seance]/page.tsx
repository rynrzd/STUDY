import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Dupliquer } from "@/components/studio/Dupliquer";
import { Editeur } from "@/components/studio/Editeur";
import { chapitresDuCours, coursDuProfesseur, seanceComplete } from "@/lib/studio";
import { jetonAccesDe, sessionCourante } from "@/lib/session-serveur";

/**
 * Édition d'une séance — cahier V2, §9.4 à §9.7.
 *
 * Une séance qui n'existe pas et une séance qu'on n'a pas le droit de voir
 * répondent toutes deux 404. C'est la politique de non-divulgation : un 403
 * confirmerait l'existence de l'objet à qui essaie des identifiants.
 */
export const dynamic = "force-dynamic";

export default async function PageSeance({
  params,
}: {
  params: Promise<{ seance: string }>;
}) {
  const personne = await sessionCourante();
  if (personne === null) redirect("/connexion");

  const { seance: id } = await params;
  const jeton = await jetonAccesDe(personne);
  if (jeton === null) redirect("/connexion");

  const ensemble = await seanceComplete(jeton, id);
  if (ensemble === null) notFound();

  const [chapitres, cours] = await Promise.all([
    chapitresDuCours(jeton, ensemble.seance.teaching_space_id),
    coursDuProfesseur(jeton),
  ]);

  return (
    <>
      <nav aria-label="Fil d'Ariane" className="mb-6">
        <Link href="/studio" className="lien-fleche text-[length:var(--text-tableau)]">
          <span aria-hidden="true">←</span> Retour au Studio
        </Link>
      </nav>

      <Editeur
        seance={ensemble.seance}
        blocs={ensemble.blocs}
        chapitres={chapitres}
        libelleCours={ensemble.cours?.libelle ?? "Cours"}
      />

      <div className="mt-10">
        <Dupliquer
          seance={ensemble.seance.id}
          titre={ensemble.seance.title}
          cours={cours.map((unCours) => ({ id: unCours.id, libelle: unCours.libelle }))}
          coursActuel={ensemble.seance.teaching_space_id}
        />
      </div>
    </>
  );
}
