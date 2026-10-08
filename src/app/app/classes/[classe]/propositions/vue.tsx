import Link from "next/link";
import { Lightbulb, Lock, MessageSquareText } from "lucide-react";
import { FormulaireChangerDecision, FormulaireDecision } from "@/components/study/classe-formulaires";
import { EtatVide, Etiquette, OngletsLiens, Panneau, TuileIcone, dateLisible } from "@/components/study/ui";
import { STATUTS_DECISION, TRANSITIONS_DECISION, type consultations, type decisions } from "@/lib/v6/classe";

export const FILTRES = [
  { cle: "toutes", libelle: "Toutes", statuts: null },
  { cle: "discussion", libelle: "En discussion", statuts: ["proposee", "discutee"] },
  { cle: "transmises", libelle: "Transmises", statuts: ["transmise", "repondue"] },
  { cle: "en_cours", libelle: "En cours", statuts: ["en_cours"] },
  { cle: "closes", libelle: "Clôturées", statuts: ["faite", "refusee"] },
] as const;

/** Vue de la page, rendue avec des données réelles (page.tsx) ou fictives (aperçu de développement). */
export function VuePropositions({ classe, vue, anime, liste, ouverte, base, filtreActif, compte, visibles, suivies, parDecision, evenements, titres }: {
  classe: string;
  vue: string;
  anime: boolean;
  liste: Awaited<ReturnType<typeof decisions>>;
  ouverte: Awaited<ReturnType<typeof consultations>>[number] | undefined;
  base: string;
  filtreActif: (typeof FILTRES)[number];
  compte: (statuts: readonly string[] | null) => number;
  visibles: Awaited<ReturnType<typeof decisions>>;
  suivies: Awaited<ReturnType<typeof decisions>>;
  parDecision: Map<string, number>;
  evenements: readonly { id: number; decision_id: string; de_statut: string | null; vers_statut: string; motif: string | null; created_at: string }[];
  titres: Map<string, string>;
}) {
  return (
    <div className="grid gap-6">
      <section className="flex flex-wrap items-center justify-between gap-4 rounded-[var(--radius-carte)] bg-[color:var(--color-rose-clair)] p-6">
        <div className="min-w-0">
          <p className="sourcil">Vie de classe</p>
          <h2 className="titre-section m-0">Un espace pour améliorer la vie de classe</h2>
          <p className="m-0 mt-1 max-w-[60ch] text-[color:var(--color-encre-faible)]">
            Les délégués soumettent ici des propositions au nom de la classe. Chacune est discutée, transmise et suivie jusqu&apos;à sa
            réponse.
          </p>
        </div>
        {anime ? null : ouverte ? (
          <Link href={`/app/classes/${classe}/consultations/${ouverte.id}`} className="bouton bouton-primaire">
            Donner mon avis
          </Link>
        ) : null}
      </section>

      <OngletsLiens
        etiquette="Vue"
        onglets={[
          { href: `${base}?vue=propositions`, libelle: "Propositions", compte: liste.length, actif: vue === "propositions" },
          { href: `${base}?vue=suivi`, libelle: "Suivi", compte: suivies.length, actif: vue === "suivi" },
          { href: `${base}?vue=historique`, libelle: "Historique", actif: vue === "historique" },
        ]}
      />

      {vue === "propositions" ? (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_340px]">
          <section aria-labelledby="liste-propositions">
            <h2 id="liste-propositions" className="sr-only">
              Propositions
            </h2>
            <div className="mb-4 flex flex-wrap gap-2" role="group" aria-label="Filtrer par statut">
              {FILTRES.map((f) => (
                <Link
                  key={f.cle}
                  href={`${base}?vue=propositions&filtre=${f.cle}`}
                  aria-current={filtreActif.cle === f.cle ? "page" : undefined}
                  className="pilule"
                >
                  {f.libelle} ({compte(f.statuts)})
                </Link>
              ))}
            </div>
            {visibles.length === 0 ? (
              <EtatVide icone={Lightbulb} titre="Aucune proposition ici" texte={anime ? "Ajoutez la première proposition de la classe." : "Les propositions de vos délégués apparaîtront ici."} />
            ) : (
              <ul className="m-0 grid list-none gap-3 p-0">
                {visibles.map((d) => (
                  <li key={d.id} className="panneau">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <TuileIcone icone={Lightbulb} />
                      <div className="min-w-0 flex-1">
                        <p className="m-0 font-semibold">{d.titre}</p>
                        {d.explication ? <p className="m-0 mt-1 text-[0.9375rem]">{d.explication}</p> : null}
                        <p className="meta m-0 mt-2 flex items-center gap-1">
                          <MessageSquareText size={14} strokeWidth={1.75} aria-hidden="true" /> {parDecision.get(d.id) ?? 0} étape
                          {(parDecision.get(d.id) ?? 0) > 1 ? "s" : ""} de suivi · dernière activité le {dateLisible(d.majLe, { day: "numeric", month: "long" })}
                          {!d.publiee ? " · non publiée" : ""}
                        </p>
                        {d.statut === "refusee" && d.motif ? <p className="meta m-0 mt-1">Motif : {d.motif}</p> : null}
                        {d.statut === "en_cours" ? (
                          <p className="meta m-0 mt-1">
                            Suivi par {d.responsable}
                            {d.suiviLe ? ` · point prévu le ${dateLisible(d.suiviLe, { day: "numeric", month: "long" })}` : ""}
                          </p>
                        ) : null}
                      </div>
                      <Etiquette ton={STATUTS_DECISION[d.statut]?.ton ?? "neutre"}>{STATUTS_DECISION[d.statut]?.libelle ?? d.statut}</Etiquette>
                    </div>
                    {anime ? <FormulaireChangerDecision classe={classe} decision={d.id} version={d.version} suivants={TRANSITIONS_DECISION[d.statut] ?? []} /> : null}
                  </li>
                ))}
              </ul>
            )}
          </section>
          <aside className="grid content-start gap-4">
            {anime ? (
              <Panneau titre="Nouvelle proposition">
                <FormulaireDecision classe={classe} consultation={ouverte?.id} />
              </Panneau>
            ) : (
              <Panneau titre="Une idée pour la classe ?" className="border-0 bg-[color:var(--color-rose-clair)]">
                <p className="m-0 text-[0.9375rem]">
                  Parle-en à tes délégués, ou réponds à la consultation du mois quand elle est ouverte : ils transforment les idées en
                  propositions.
                </p>
              </Panneau>
            )}
            <p className="meta m-0 flex gap-2">
              <Lock size={14} strokeWidth={1.75} aria-hidden="true" className="mt-0.5 shrink-0" />
              Les propositions publiées sont visibles des membres de la classe et de ses professeurs. Leur auteur technique est enregistré par
              Study.
            </p>
          </aside>
        </div>
      ) : null}

      {vue === "suivi" ? (
        <Panneau titre="Actions en cours" compte={suivies.length}>
          {suivies.length === 0 ? (
            <p className="m-0 text-[color:var(--color-encre-faible)]">Aucune action en cours.</p>
          ) : (
            <ul className="m-0 list-none p-0">
              {suivies.map((d) => (
                <li key={d.id} className="ligne items-start">
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold">{d.titre}</span>
                    <span className="meta">
                      Responsable : {d.responsable}
                      {d.suiviLe ? ` · prochain point le ${dateLisible(d.suiviLe, { day: "numeric", month: "long" })}` : ""}
                    </span>
                  </span>
                  <Etiquette ton="attention">En cours</Etiquette>
                </li>
              ))}
            </ul>
          )}
        </Panneau>
      ) : null}

      {vue === "historique" ? (
        <Panneau titre="Historique des changements">
          {evenements.length === 0 ? (
            <p className="m-0 text-[color:var(--color-encre-faible)]">Aucun changement pour l&apos;instant.</p>
          ) : (
            <ol className="m-0 list-none p-0">
              {evenements.map((e) => (
                <li key={e.id} className="ligne items-start">
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold">{titres.get(e.decision_id) ?? "Proposition"}</span>
                    <span className="meta">
                      {e.de_statut ? `${STATUTS_DECISION[e.de_statut]?.libelle ?? e.de_statut} → ` : ""}
                      {STATUTS_DECISION[e.vers_statut]?.libelle ?? e.vers_statut} · {dateLisible(e.created_at, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}
                      {e.motif ? ` · ${e.motif}` : ""}
                    </span>
                  </span>
                </li>
              ))}
            </ol>
          )}
        </Panneau>
      ) : null}
    </div>
  );
}
