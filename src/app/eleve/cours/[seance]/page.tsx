import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Entraide } from "@/components/app/Entraide";
import { VueSeance } from "@/components/seance/VueSeance";
import { jetonAccesDe, sessionCourante } from "@/lib/session-serveur";
import { filsDeLaSeance } from "@/lib/parcours-eleve";
import { seanceComplete } from "@/lib/studio";

export const metadata: Metadata = { title: "Séance" };

/**
 * Une séance vue par l'élève — cahier V2, §10.
 *
 * Le rendu est celui de `VueSeance`, exactement le même composant que la
 * prévisualisation du professeur : c'est ce qui garantit que « prévisualiser »
 * dit la vérité.
 *
 * Deux refus se confondent volontairement en une seule 404 : la séance
 * n'existe pas, ou elle appartient à une autre classe. Distinguer les deux
 * apprendrait à un élève curieux quels identifiants existent.
 */
export const dynamic = "force-dynamic";

export default async function PageSeanceEleve({
  params,
}: {
  params: Promise<{ seance: string }>;
}) {
  const personne = await sessionCourante();
  if (personne === null) redirect("/connexion");

  const jeton = await jetonAccesDe(personne);
  if (jeton === null) redirect("/connexion");

  const { seance: id } = await params;
  const complet = await seanceComplete(jeton, id);

  // Un brouillon n'est pas une séance pour l'élève, même si RLS le laissait
  // passer : la vérification est ici en plus, pas à la place.
  if (complet === null || complet.seance.state !== "publiee") notFound();

  const fils = await filsDeLaSeance(jeton, id);

  return (
    <>
      <p className="m-0">
        <Link
          href={
            complet.cours === null
              ? "/eleve/cours"
              : `/eleve/cours?cours=${complet.cours.id}`
          }
          className="text-[length:var(--text-tableau)] text-[color:var(--color-encre-faible)] no-underline hover:text-[color:var(--color-accent)]"
        >
          ← {complet.cours?.libelle ?? "Mes cours"}
        </Link>
      </p>

      <div className="mt-5 max-w-[860px]">
        <VueSeance
          seance={complet.seance}
          blocs={complet.blocs}
          libelleCours={complet.cours?.libelle ?? "Cours"}
          chapitre={complet.chapitre?.label ?? null}
        />

        <Entraide seance={id} fils={fils} moi={personne.profileId} />
      </div>
    </>
  );
}
