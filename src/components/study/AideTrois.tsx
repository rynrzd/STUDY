import { CircleHelp } from "lucide-react";

/**
 * Aide très courte intégrée à un écran — cahier des charges ch. 05 (ONB-07) :
 * pourquoi ce geste, qui voit le résultat, que se passe-t-il ensuite. Repliée
 * par défaut ; un administrateur doit réussir sans documentation externe.
 */
export function AideTrois({ pourquoi, quiVoit, apres }: { pourquoi: string; quiVoit: string; apres: string }) {
  return (
    <details className="aide-trois mb-6">
      <summary className="inline-flex cursor-pointer items-center gap-2 text-[0.875rem] font-semibold text-[color:var(--color-accent)]">
        <CircleHelp size={16} strokeWidth={1.75} aria-hidden="true" /> Comprendre cet écran
      </summary>
      <dl className="m-0 mt-3 grid gap-3 sm:grid-cols-3">
        <div>
          <dt className="font-bold">Pourquoi ?</dt>
          <dd className="meta m-0 mt-1">{pourquoi}</dd>
        </div>
        <div>
          <dt className="font-bold">Qui voit ça ?</dt>
          <dd className="meta m-0 mt-1">{quiVoit}</dd>
        </div>
        <div>
          <dt className="font-bold">Et après ?</dt>
          <dd className="meta m-0 mt-1">{apres}</dd>
        </div>
      </dl>
    </details>
  );
}
