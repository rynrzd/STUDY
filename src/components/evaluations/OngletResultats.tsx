import { CircleAlert, Download, Printer, Target, Users } from "lucide-react";
import { publierResultats } from "@/app/professeur/evaluations/actions";
import { FormulaireAction } from "@/components/evaluations/FormulairesProf";
import { CarteChiffre, Encadre } from "@/components/study/ui";
import { formaterNote, LIBELLES_NIVEAU, niveauMaitrise, ORDRE_NIVEAUX, texteModele, type Niveau } from "@/lib/evaluations/analyse";
import type { EvaluationProf, Suivi } from "@/lib/v6/evaluations";

/** Couleurs de la carte de maîtrise : l'état est aussi écrit, jamais porté par la seule couleur. */
const FOND: Record<Niveau, string> = {
  non_acquis: "bg-[#f8d9d6] text-[#7a211c]",
  fragile: "bg-[#fbe6c8] text-[#6b4510]",
  satisfaisant: "bg-[#dcefe2] text-[#245536]",
  tres_bonne_maitrise: "bg-[#2f6a45] text-white",
};
const COURT: Record<Niveau, string> = { non_acquis: "NA", fragile: "F", satisfaisant: "S", tres_bonne_maitrise: "TB" };

const pourcent = (r: number | null) => (r === null ? "—" : `${Math.round(r * 100)} %`);

/** Onglet « Résultats » : ce que la classe a réussi, ce qui revient, quoi reprendre. */
export function OngletResultats({ prof, suivi }: { prof: EvaluationProf; suivi: Suivi }) {
  const e = prof.evaluation;
  const a = suivi.analyse;
  const avecNote = e.notation !== "maitrise";
  const avecMaitrise = e.notation !== "sur20";
  const publiee = e.resultatsPubliesLe !== null;
  const presents = a.eleves.filter((x) => x.statut === "corrigee" || x.statut === "a_corriger").sort((x, y) => x.nom.localeCompare(y.nom, "fr"));

  if (!e.distribueeLe) return <Encadre titre="Pas encore de résultats">Distribuez l&apos;évaluation pour suivre les résultats ici.</Encadre>;

  return (
    <div className="grid gap-6">
      <div className="grid gap-3 sm:grid-cols-3">
        <CarteChiffre icone={Users} libelle="Copies rendues" valeur={`${a.rendues} / ${a.eleves.length}`} />
        <CarteChiffre icone={Target} libelle={avecNote ? "Moyenne sur 20" : "Réussite moyenne"} valeur={avecNote ? formaterNote(a.moyenne) : pourcent(a.moyenne === null ? null : a.moyenne / 20)} />
        <CarteChiffre icone={CircleAlert} libelle="Réponses à corriger" valeur={a.aCorrigerTotal} detail={a.aCorrigerTotal > 0 ? "Onglet Correction" : "Tout est corrigé"} />
      </div>

      <section className="panneau" aria-labelledby="publication">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div className="min-w-0">
            <h2 id="publication" className="titre-bloc m-0 font-bold">
              {publiee ? "Résultats publiés" : "Publier les résultats"}
            </h2>
            <p className="meta m-0 mt-1">
              {publiee
                ? "Chaque élève voit sa copie corrigée, l'explication de chaque question et sa remise à niveau. Les notions ratées sont « à revoir » dans sa révision."
                : "L'évaluation se clôt : chaque élève voit sa copie corrigée, et les notions réussies à moins de moitié repassent « à revoir » dans sa révision."}
            </p>
          </div>
          <div className="flex flex-wrap items-start gap-2">
            <a href={`/professeur/evaluations/${e.id}/export`} className="bouton bouton-secondaire">
              <Download size={16} aria-hidden="true" /> Export pour Pronote
            </a>
            <a href={`/professeur/evaluations/${e.id}/imprimer`} className="bouton bouton-secondaire">
              <Printer size={16} aria-hidden="true" /> Imprimer
            </a>
            {!publiee ? (
              <FormulaireAction
                action={publierResultats}
                evaluation={e.id}
                libelle="Publier les résultats"
                enCours="Publication…"
                confirmation={a.aCorrigerTotal > 0 ? `${a.aCorrigerTotal} réponse(s) ne sont pas corrigées : elles compteront 0. Publier quand même ?` : "Publier les résultats aux élèves ? L'évaluation sera close."}
              />
            ) : null}
          </div>
        </div>
      </section>

      {a.aReprendre.length > 0 ? (
        <section className="panneau border-l-[4px] border-l-[color:var(--color-accent)]" aria-labelledby="reprendre">
          <h2 id="reprendre" className="titre-bloc m-0 font-bold">
            À reprendre en classe
          </h2>
          <ol className="m-0 mt-3 grid list-none gap-2 p-0">
            {a.aReprendre.map((n, i) => (
              <li key={n.notionId} className="flex flex-wrap items-baseline gap-x-3">
                <span className="text-[1.5rem] font-extrabold leading-none text-[color:var(--color-accent)]">{i + 1}</span>
                <span className="font-bold">{n.notion}</span>
                <span className="meta">
                  {pourcent(n.reussite)} de réussite · {n.niveaux.non_acquis + n.niveaux.fragile} élève{n.niveaux.non_acquis + n.niveaux.fragile > 1 ? "s" : ""} en difficulté
                </span>
              </li>
            ))}
          </ol>
        </section>
      ) : null}

      <section className="panneau" aria-labelledby="par-question">
        <h2 id="par-question" className="titre-bloc m-0 mb-4 font-bold">
          Question par question
        </h2>
        <ol className="m-0 grid list-none gap-4 p-0">
          {a.questions.map((q) => (
            <li key={q.id}>
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <p className="m-0 min-w-0 font-semibold">
                  {q.ordre}. {texteModele(q.enonce)}
                </p>
                <span className="font-bold">{pourcent(q.reussite)}</span>
              </div>
              <div className="mt-2 h-2 overflow-hidden rounded-full bg-[color:var(--color-survol)]" aria-hidden="true">
                <div className="h-full rounded-full bg-[color:var(--color-accent)]" style={{ width: `${Math.round((q.reussite ?? 0) * 100)}%` }} />
              </div>
              <p className="meta m-0 mt-1">
                {q.corrigees} copie{q.corrigees > 1 ? "s" : ""} corrigée{q.corrigees > 1 ? "s" : ""}
                {q.aCorriger > 0 ? ` · ${q.aCorriger} à corriger` : ""}
                {q.notion ? ` · ${q.notion}` : ""}
              </p>
              {q.erreurPrincipale ? (
                <p className="m-0 mt-1 text-[0.9375rem] text-[color:var(--color-erreur)]">
                  Erreur la plus fréquente : {Math.round(q.erreurPrincipale.part * 100)} % ont répondu « {texteModele(q.erreurPrincipale.libelle)} »
                  {q.erreurPrincipale.libelle.includes("{") ? " (avec leurs propres valeurs)" : ""}.
                </p>
              ) : null}
            </li>
          ))}
        </ol>
      </section>

      {a.notions.length > 0 && presents.length > 0 ? (
        <section className="panneau" aria-labelledby="carte">
          <h2 id="carte" className="titre-bloc m-0 font-bold">
            Carte de maîtrise
          </h2>
          <p className="meta m-0 mb-3 mt-1">
            {ORDRE_NIVEAUX.map((n) => `${COURT[n]} : ${LIBELLES_NIVEAU[n]}`).join(" · ")}
          </p>
          <div className="overflow-x-auto">
            <table className="border-collapse text-[0.875rem]">
              <thead>
                <tr>
                  <th className="py-1 pr-3 text-left font-bold">Élève</th>
                  {a.notions.map((n) => (
                    <th key={n.notionId} className="max-w-[120px] px-1 py-1 text-left align-bottom font-bold">
                      {n.notion}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {presents.map((x) => (
                  <tr key={x.copieId}>
                    <td className="whitespace-nowrap py-1 pr-3">
                      {x.nom} {x.prenom}
                    </td>
                    {a.notions.map((n) => {
                      const r = x.parNotion[n.notionId];
                      if (r === undefined) return <td key={n.notionId} className="px-1 py-1 text-center text-[color:var(--color-encre-faible)]">—</td>;
                      const niveau = niveauMaitrise(r);
                      return (
                        <td key={n.notionId} className="px-1 py-1">
                          <span className={`grid h-8 min-w-[48px] place-items-center rounded-[var(--rayon-s)] font-bold ${FOND[niveau]}`} title={`${LIBELLES_NIVEAU[niveau]} (${pourcent(r)})`}>
                            {COURT[niveau]}
                          </span>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      <section className="panneau" aria-labelledby="eleves-resultats">
        <h2 id="eleves-resultats" className="titre-bloc m-0 mb-3 font-bold">
          Élèves
        </h2>
        <ul className="liste-r2">
          {[...a.eleves]
            .sort((x, y) => x.nom.localeCompare(y.nom, "fr"))
            .map((x) => (
              <li key={x.copieId}>
                <div className="ligne-r2">
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold">
                      {x.nom} {x.prenom}
                    </span>
                    <span className="meta block">
                      {x.statut === "absent" ? "Absent" : x.statut === "en_cours" ? "En train de composer" : `${String(x.points).replace(".", ",")} / ${String(x.maximum).replace(".", ",")} point${x.maximum > 1 ? "s" : ""}`}
                      {x.aCorriger > 0 ? ` · ${x.aCorriger} à corriger` : ""}
                      {x.sortiesOnglet > 0 ? ` · ${x.sortiesOnglet} sortie${x.sortiesOnglet > 1 ? "s" : ""} d'onglet` : ""}
                    </span>
                  </span>
                  {avecNote && x.note !== null ? <span className="text-[1.25rem] font-extrabold">{formaterNote(x.note)}</span> : null}
                  {avecMaitrise && x.niveau ? <span className={`rounded-full px-3 py-1 text-[0.8125rem] font-bold ${FOND[x.niveau]}`}>{LIBELLES_NIVEAU[x.niveau]}</span> : null}
                </div>
              </li>
            ))}
        </ul>
      </section>
    </div>
  );
}
