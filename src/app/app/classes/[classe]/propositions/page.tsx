import Link from "next/link";
import { Lock, MessageSquareText } from "lucide-react";
import { FormulaireChangerDecision, FormulaireDecision } from "@/components/study/classe-formulaires";
import { AccesIndisponible, EtatVide, Etiquette, Panneau, dateLisible } from "@/components/study/ui";
import { clientUtilisateur } from "@/lib/supabase-serveur";
import { consultations, decisions, droits as lireDroits, STATUTS_DECISION, TRANSITIONS_DECISION } from "@/lib/v6/classe";
import { contexteApp } from "@/lib/v6/contexte";

export const metadata = { title: "Propositions et suivi" };
export const dynamic = "force-dynamic";

/**
 * A14 — Vie de classe : propositions des délégués et leur suivi.
 *
 * Statuts réels (0050) : proposée → discutée → transmise → réponse reçue →
 * en cours → faite, ou non retenue (motif obligatoire). Les filtres
 * regroupent ces statuts ; chaque changement est journalisé (historique).
 * Faire une proposition et changer un statut : délégués et professeur
 * principal seulement (`anime_vie_de_classe`, vérifié en base). Les élèves
 * voient les propositions publiées ; aucune promesse d'anonymat n'est faite.
 */
const FILTRES = [
  { cle: "toutes", libelle: "Toutes", statuts: null },
  { cle: "discussion", libelle: "En discussion", statuts: ["proposee", "discutee"] },
  { cle: "transmises", libelle: "Transmises", statuts: ["transmise", "repondue"] },
  { cle: "en_cours", libelle: "En cours", statuts: ["en_cours"] },
  { cle: "closes", libelle: "Clôturées", statuts: ["faite", "refusee"] },
] as const;

export default async function PagePropositions({ params, searchParams }: { params: Promise<{ classe: string }>; searchParams: Promise<{ vue?: string; filtre?: string }> }) {
  const ctx = await contexteApp();
  const { classe } = await params;
  const { vue = "propositions", filtre = "toutes" } = await searchParams;
  const droits = await lireDroits(ctx.jeton, classe);
  if (!droits.membre) return <AccesIndisponible retour="/app/classe" />;
  const anime = droits.delegue || droits.principal;

  const [liste, lesConsultations] = await Promise.all([decisions(ctx.jeton, classe), consultations(ctx.jeton, classe)]);
  const ids = liste.map((d) => d.id);
  const { data: evenementsBruts } = ids.length
    ? await clientUtilisateur(ctx.jeton)
        .from("decision_evenements")
        .select("id, decision_id, de_statut, vers_statut, motif, created_at")
        .in("decision_id", ids)
        .order("created_at", { ascending: false })
        .limit(200)
    : { data: [] };
  const evenements = (evenementsBruts ?? []) as { id: number; decision_id: string; de_statut: string | null; vers_statut: string; motif: string | null; created_at: string }[];
  const parDecision = new Map<string, number>();
  for (const e of evenements) parDecision.set(e.decision_id, (parDecision.get(e.decision_id) ?? 0) + 1);
  const titres = new Map(liste.map((d) => [d.id, d.titre]));

  const filtreActif = FILTRES.find((f) => f.cle === filtre) ?? FILTRES[0];
  const compte = (statuts: readonly string[] | null) => liste.filter((d) => !statuts || statuts.includes(d.statut)).length;
  const visibles = liste.filter((d) => !filtreActif.statuts || (filtreActif.statuts as readonly string[]).includes(d.statut));
  const suivies = liste.filter((d) => d.statut === "en_cours");
  const ouverte = lesConsultations.find((c) => c.etat === "ouverte");
  const base = `/app/classes/${classe}/propositions`;

  return (
    <div className="grid gap-6">
      <section className="panneau panneau-rose flex flex-wrap items-center justify-between gap-4">
        <div className="min-w-0">
          <h2 className="titre-section m-0">Un espace pour améliorer la vie de classe</h2>
          <p className="m-0 mt-1 max-w-[60ch] text-[color:var(--color-accent-fonce)]">
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

      <nav aria-label="Vue" className="flex flex-wrap gap-2 border-b border-[color:var(--color-bordure)] pb-2">
        {[
          { cle: "propositions", libelle: "Propositions" },
          { cle: "suivi", libelle: "Suivi" },
          { cle: "historique", libelle: "Historique" },
        ].map((o) => (
          <Link key={o.cle} href={`${base}?vue=${o.cle}`} aria-current={vue === o.cle ? "page" : undefined} className={`bouton bouton-compact ${vue === o.cle ? "bouton-primaire" : "bouton-discret"}`}>
            {o.libelle}
          </Link>
        ))}
      </nav>

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
                  aria-current={filtreActif.cle === f.cle ? "true" : undefined}
                  className={`bouton bouton-compact ${filtreActif.cle === f.cle ? "bouton-rose" : "bouton-secondaire"}`}
                >
                  {f.libelle} ({compte(f.statuts)})
                </Link>
              ))}
            </div>
            {visibles.length === 0 ? (
              <EtatVide titre="Aucune proposition ici" texte={anime ? "Ajoutez la première proposition de la classe." : "Les propositions de vos délégués apparaîtront ici."} />
            ) : (
              <ul className="m-0 grid list-none gap-3 p-0">
                {visibles.map((d) => (
                  <li key={d.id} className="panneau">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="min-w-0">
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
              <Panneau titre="Une idée pour la classe ?">
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
        <Panneau titre="Actions en cours">
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
