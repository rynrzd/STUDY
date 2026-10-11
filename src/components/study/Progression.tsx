import { CircleCheck } from "lucide-react";
import type { MatiereSuivie, Statut } from "@/lib/v6/progression";
import { Etiquette, type Ton, dateLisible } from "./ui";

const TON: Record<Statut, Ton> = { a_revoir: "attention", en_cours: "rose", a_decouvrir: "neutre", inconnu: "neutre", consolide: "succes" };

/**
 * « Où j'en suis » — page Réviser. Une matière par bloc, repliable : en tête
 * le nombre de notions par état, dessous chaque notion avec son état écrit,
 * ses réussites récentes sans aide et sa prochaine révision. La règle de
 * consolidation est dite telle qu'elle est appliquée.
 */
export function Progression({ matieres }: { matieres: readonly MatiereSuivie[] | null }) {
  return (
    <section aria-labelledby="progression" className="mb-8">
      <h2 id="progression" className="titre-section m-0">
        Où j&apos;en suis
      </h2>
      <p className="meta m-0 mb-3 mt-1">
        Une notion est « consolidée » après trois réussites sans aide, sur deux jours et deux exercices différents. Ce sont des repères pour toi : personne d&apos;autre ne les voit.
      </p>
      {matieres === null ? (
        <p role="alert" className="m-0 text-[color:var(--color-erreur)]">
          Ta progression n&apos;a pas pu être chargée.
        </p>
      ) : matieres.length === 0 ? (
        <div className="encadre" data-ton="neutre">
          <p className="m-0">Aucune notion à suivre pour l&apos;instant : elles apparaissent quand tes professeurs publient des exercices rattachés à des notions.</p>
        </div>
      ) : (
        <div className="grid gap-3">
          {matieres.map((m, i) => (
            <details key={m.matiere} open={i === 0} className="panneau p-0 md:p-0">
              <summary className="flex min-h-[56px] cursor-pointer flex-wrap items-center gap-x-3 gap-y-1 px-5 py-3">
                <span className="font-bold">{m.matiere}</span>
                <span className="meta">
                  {m.compte.consolide} consolidée{m.compte.consolide > 1 ? "s" : ""} · {m.compte.en_cours} en cours · {m.compte.a_revoir} à revoir
                  {m.compte.a_decouvrir > 0 ? ` · ${m.compte.a_decouvrir} à découvrir` : ""}
                </span>
                <span className="ml-auto flex h-2 w-40 max-w-full overflow-hidden rounded-full bg-[color:var(--color-survol)]" aria-hidden="true">
                  <span className="h-full bg-[color:var(--color-accent)]" style={{ width: `${(m.compte.consolide / m.notions.length) * 100}%` }} />
                  <span className="h-full bg-[color:var(--color-surlignage)]" style={{ width: `${(m.compte.en_cours / m.notions.length) * 100}%` }} />
                </span>
              </summary>
              <ul className="m-0 list-none border-t border-[color:var(--color-bordure)] p-0">
                {m.notions.map((n) => (
                  <li key={n.id} className="flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-[color:var(--color-bordure)] px-5 py-3 last:border-0">
                    {n.statut === "consolide" ? (
                      <CircleCheck size={18} strokeWidth={1.75} aria-hidden="true" className="shrink-0 text-[color:var(--color-succes)]" />
                    ) : (
                      <span className="w-[18px] shrink-0" aria-hidden="true" />
                    )}
                    <span className="min-w-0 flex-1 font-semibold">{n.notion}</span>
                    <span className="meta">
                      {n.tentativesRecentes > 0 ? `${n.reussitesRecentes} réussite${n.reussitesRecentes > 1 ? "s" : ""} sans aide sur ${n.tentativesRecentes}` : "Pas encore essayée"}
                      {n.statut !== "consolide"
                        ? !n.rappelsActifs
                          ? " · rappels coupés"
                          : n.prochaineRevision
                            ? ` · à revoir le ${dateLisible(`${n.prochaineRevision}T12:00:00Z`, { day: "numeric", month: "short" })}`
                            : ""
                        : ""}
                    </span>
                    <Etiquette ton={TON[n.statut]}>{n.libelleStatut}</Etiquette>
                  </li>
                ))}
              </ul>
            </details>
          ))}
        </div>
      )}
    </section>
  );
}
