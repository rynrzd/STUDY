import { CircleCheck, CircleHelp } from "lucide-react";
import { marquerCompris } from "@/app/app/seances/actions";
import type { MonPassage, PassageDeClasse } from "@/lib/v6/passages";
import { dateLisible } from "./ui";

/** Élève : ses passages signalés sur la séance, et « C'est compris ». */
export function MesPassagesIncompris({ seance, passages }: { seance: string; passages: readonly MonPassage[] | null }) {
  if (passages === null) return null;
  return (
    <section className="panneau" aria-labelledby="mes-passages">
      <h2 id="mes-passages" className="titre-bloc m-0 font-bold">
        Mes passages pas compris
      </h2>
      {passages.length === 0 ? (
        <p className="meta m-0 mt-2">Sélectionne une phrase du cours puis « Je n&apos;ai pas compris » : tu la retrouveras ici, et ton professeur saura qu&apos;elle pose problème, sans ton nom.</p>
      ) : (
        <ul className="m-0 mt-3 grid list-none gap-2 p-0">
          {passages.map((p) => (
            <li key={p.id} className="rounded-[4px] bg-[color:var(--color-rose-clair)] p-3">
              <p className="m-0 line-clamp-3 text-[0.875rem]">« {p.extrait} »</p>
              <form action={marquerCompris} className="mt-2">
                <input type="hidden" name="passage" value={p.id} />
                <input type="hidden" name="seance" value={seance} />
                <button type="submit" className="bouton bouton-compact bouton-secondaire">
                  <CircleCheck size={16} strokeWidth={1.75} aria-hidden="true" /> C&apos;est compris
                </button>
              </form>
            </li>
          ))}
        </ul>
      )}
      <p className="meta m-0 mt-3">Personne ne voit tes signalements ; ton professeur ne voit qu&apos;un nombre d&apos;élèves par passage.</p>
    </section>
  );
}

/** Professeur : les passages de la séance que des élèves n'ont pas compris, en nombres. */
export function PassagesIncomprisClasse({ passages }: { passages: readonly PassageDeClasse[] | null }) {
  if (passages === null) return null;
  return (
    <section className="panneau" aria-labelledby="passages-classe">
      <h2 id="passages-classe" className="titre-bloc m-0 font-bold">
        Passages qui posent problème
      </h2>
      {passages.length === 0 ? (
        <p className="meta m-0 mt-2">Aucun élève n&apos;a signalé de passage non compris sur cette séance.</p>
      ) : (
        <ul className="m-0 mt-3 grid list-none gap-2 p-0">
          {passages.map((p, i) => (
            <li key={i} className="flex gap-3 rounded-[4px] border border-[color:var(--color-bordure)] p-3">
              <CircleHelp size={18} strokeWidth={1.75} aria-hidden="true" className="mt-0.5 shrink-0 text-[color:var(--color-accent)]" />
              <span className="min-w-0">
                <span className="block line-clamp-3 text-[0.875rem]">« {p.extrait} »</span>
                <span className="meta block">
                  {p.eleves} élève{p.eleves > 1 ? "s" : ""} · dernier signalement le {dateLisible(p.dernier, { day: "numeric", month: "short" })}
                </span>
              </span>
            </li>
          ))}
        </ul>
      )}
      <p className="meta m-0 mt-3">Des nombres seulement : les élèves qui signalent restent anonymes.</p>
    </section>
  );
}
