import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { VueSeance } from "@/components/seance/VueSeance";
import { jetonAccesDe, sessionCourante } from "@/lib/session-serveur";
import { seanceComplete } from "@/lib/studio";

/**
 * Prévisualisation côté élève — cahier V2, §9.4 et §9.7.
 *
 * Le rendu est celui du composant que l'élève utilise, sans réimplémentation :
 * deux rendus séparés divergeraient au premier changement, et « prévisualiser »
 * cesserait de vouloir dire quelque chose.
 *
 * Le bandeau rappelle que c'est un aperçu — et, si la séance est encore un
 * brouillon, qu'aucun élève ne la voit pour l'instant.
 */
export const dynamic = "force-dynamic";

export default async function PageApercu({
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

  const publiee = ensemble.seance.state === "publiee";

  return (
    <>
      <div className="mb-6 flex flex-wrap items-center justify-between gap-3">
        <Link href={`/studio/${id}`} className="lien-fleche text-[length:var(--text-tableau)]">
          <span aria-hidden="true">←</span> Retour à l&apos;édition
        </Link>
        <span className={`pastille ${publiee ? "pastille-publie" : "pastille-brouillon"}`}>
          {publiee ? "Publiée" : "Brouillon — aucun élève ne la voit"}
        </span>
      </div>

      <div
        role="note"
        className="mb-6 rounded-[var(--radius-carte)] bg-[color:var(--color-rose-clair)] px-4 py-3 text-[length:var(--text-tableau)] text-[color:var(--color-accent)]"
      >
        Vous voyez cette séance exactement comme un élève de la classe la verra.
      </div>

      <VueSeance
        seance={ensemble.seance}
        blocs={ensemble.blocs}
        libelleCours={ensemble.cours?.libelle ?? "Cours"}
        chapitre={ensemble.chapitre?.label ?? null}
      />
    </>
  );
}
