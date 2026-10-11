import Link from "next/link";
import { TriangleAlert } from "lucide-react";
import { pointsBloquants, type PointBloquant } from "@/lib/v6/questions-seance";

/**
 * Accueil professeur — « Ce qui bloque vos élèves ». Les questions des
 * trente derniers jours, regroupées par séance citée : combien de questions,
 * combien sans réponse, combien d'élèves concernés (auteurs et « même
 * question »). Des nombres, jamais des noms : c'est un repère pour décider
 * quoi reprendre en classe, pas un classement.
 */
export async function PointsBloquants({ jeton }: { jeton: string }) {
  return <VuePointsBloquants points={await pointsBloquants(jeton)} />;
}

export function VuePointsBloquants({ points }: { points: readonly PointBloquant[] | null }) {
  return (
    <section aria-labelledby="points-bloquants" className="mb-8">
      <h2 id="points-bloquants" className="titre-section m-0">
        Ce qui bloque vos élèves
      </h2>
      <p className="meta m-0 mb-3 mt-1">Questions et passages « pas compris » des 30 derniers jours, regroupés par séance. Ouvrez une séance pour répondre une fois à toute la classe.</p>
      {points === null ? (
        <p role="alert" className="m-0 text-[color:var(--color-erreur)]">
          Ce regroupement n&apos;a pas pu être calculé.
        </p>
      ) : points.length === 0 ? (
        <p className="m-0 text-[color:var(--color-encre-faible)]">Aucune question ni passage signalé ce mois-ci.</p>
      ) : (
        <ul className="liste-r2">
          {points.map((p) => (
            <li key={p.seance}>
              <Link href={p.href} className="ligne-r2 items-start">
                <span className="tuile" aria-hidden="true">
                  <TriangleAlert size={20} strokeWidth={1.75} />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{p.titre}</span>
                  <span className="meta block">
                    {[
                      p.questions > 0 ? `${p.questions} question${p.questions > 1 ? "s" : ""}` : null,
                      p.passagesIncompris > 0 ? `${p.passagesIncompris} passage${p.passagesIncompris > 1 ? "s" : ""} pas compris` : null,
                      `${p.elevesConcernes} élève${p.elevesConcernes > 1 ? "s" : ""} concerné${p.elevesConcernes > 1 ? "s" : ""}`,
                      p.questions > 0 ? (p.sansReponse > 0 ? `${p.sansReponse} sans réponse` : "questions répondues") : null,
                    ]
                      .filter(Boolean)
                      .join(" · ")}
                  </span>
                  {p.exemple ? <span className="mt-1 block truncate text-[0.875rem] text-[color:var(--color-encre-faible)]">« {p.exemple} »</span> : null}
                </span>
                {p.sansReponse > 0 || p.passagesIncompris > 0 ? <span className="etiquette-etat" data-ton="attention">À reprendre</span> : null}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
