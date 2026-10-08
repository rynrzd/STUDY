import Link from "next/link";
import { ArrowRight, BarChart3, HandHelping, Lightbulb, MessageSquareLock, Users } from "lucide-react";
import { FormulaireRevisionCollective } from "@/components/study/classe-formulaires";
import { Encadre, Etiquette, ICONE, Ligne, ListeLignes, TuileIcone, dateHeure, dateLisible } from "@/components/study/ui";
import { STATUTS_DECISION, type consultations, type decisions, type droits as lireDroits, type membres } from "@/lib/v6/classe";
import type { revisionsCollectives } from "@/lib/v6/eleve";

/** Vue de la page, rendue avec des données réelles (page.tsx) ou fictives (aperçu de développement). */
export function VueClasse({ ouverte, classe, droits, suivies, entraide, delegues, principal }: {
  ouverte: Awaited<ReturnType<typeof consultations>>[number] | undefined;
  classe: string;
  droits: Awaited<ReturnType<typeof lireDroits>>;
  suivies: Awaited<ReturnType<typeof decisions>>;
  entraide: Awaited<ReturnType<typeof revisionsCollectives>>;
  delegues: NonNullable<Awaited<ReturnType<typeof membres>>>;
  principal: NonNullable<Awaited<ReturnType<typeof membres>>>[number] | undefined;
}) {
  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(280px,1fr)]">
      <div className="grid content-start gap-8">
        {ouverte ? (
          <section className="flex flex-wrap items-center gap-5 rounded-[var(--radius-carte)] bg-[color:var(--color-rose-clair)] p-6" aria-labelledby="consultation">
            <TuileIcone icone={BarChart3} ton="neutre" grande />
            <div className="min-w-0 flex-1">
              <p className="sourcil">Consultation du mois</p>
              <h2 id="consultation" className="titre-section">
                {ouverte.titre}
              </h2>
              <p className="meta m-0 mt-1">Ouverte jusqu&apos;au {dateLisible(ouverte.fermeLe, { weekday: "long", day: "numeric", month: "long" })}.</p>
            </div>
            <Link href={`/app/classes/${classe}/consultations/${ouverte.id}`} className="bouton bouton-primaire">
              {droits.eleve ? "Donner mon avis" : "Voir la consultation"} <ArrowRight {...ICONE} />
            </Link>
          </section>
        ) : (
          <Encadre icone={BarChart3} titre="Aucune consultation ouverte en ce moment." ton="neutre">
            {droits.delegue || droits.principal ? "Vous pouvez en préparer une depuis le bureau des délégués." : "Les délégués t'inviteront à la prochaine."}
          </Encadre>
        )}

        <section aria-labelledby="suites">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
            <h2 id="suites" className="titre-section">
              Vos idées, leurs suites
            </h2>
            <Link href={`/app/classes/${classe}/propositions`} className="text-[0.875rem] font-semibold text-[color:var(--color-accent)]">
              Tout voir
            </Link>
          </div>
          {suivies.length === 0 ? (
            <p className="m-0 text-[color:var(--color-encre-faible)]">Aucun sujet suivi pour l&apos;instant.</p>
          ) : (
            <ListeLignes>
              {suivies.map((d) => (
                <Ligne
                  key={d.id}
                  icone={Lightbulb}
                  titre={<span id={`decision-${d.id}`}>{d.titre}</span>}
                  detail={
                    <>
                      {d.explication ? <span className="block">{d.explication}</span> : null}
                      {d.statut === "refusee" && d.motif ? <span className="block">Motif : {d.motif}</span> : null}
                      {d.statut === "en_cours" ? (
                        <span className="block">
                          Suivi par {d.responsable} · point prévu le {dateLisible(d.suiviLe)}
                        </span>
                      ) : null}
                    </>
                  }
                  fin={<Etiquette ton={STATUTS_DECISION[d.statut]?.ton ?? "neutre"}>{STATUTS_DECISION[d.statut]?.libelle ?? d.statut}</Etiquette>}
                />
              ))}
            </ListeLignes>
          )}
        </section>

        <section aria-labelledby="entraide">
          <h2 id="entraide" className="titre-section mb-3">
            Réviser ensemble
          </h2>
          {entraide.length === 0 ? (
            <p className="m-0 text-[color:var(--color-encre-faible)]">Aucune séance d&apos;entraide prévue. Propose-en une : la participation est volontaire.</p>
          ) : (
            <ListeLignes>
              {entraide.map((r) => (
                <Ligne key={r.id} href={`/app/entraide/${r.id}`} icone={HandHelping} titre={r.titre} detail={`${dateHeure(r.debut)} · ${r.capacite} places`} />
              ))}
            </ListeLignes>
          )}
          {droits.membre ? (
            <details className="panneau mt-3">
              <summary className="cursor-pointer font-semibold text-[color:var(--color-accent)]">Proposer une séance d&apos;entraide</summary>
              <div className="mt-4">
                <FormulaireRevisionCollective classe={classe} />
              </div>
            </details>
          ) : null}
        </section>
      </div>

      <div className="grid content-start gap-4">
        <section className="panneau" aria-labelledby="delegues">
          <div className="mb-4 flex items-center justify-between gap-3">
            <h2 id="delegues" className="titre-bloc m-0 font-bold">
              Vos délégués
            </h2>
            <Link href={`/app/classes/${classe}/membres`} className="text-[0.875rem] font-semibold text-[color:var(--color-accent)]">
              Membres
            </Link>
          </div>
          {delegues.length === 0 ? (
            <p className="m-0 text-[color:var(--color-encre-faible)]">Aucun délégué en mandat pour l&apos;instant.</p>
          ) : (
            <ul className="m-0 grid list-none gap-3 p-0">
              {delegues.map((d) => (
                <li key={d.profileId} className="flex items-center gap-3">
                  <span className="avatar" aria-hidden="true">
                    {d.initiales}
                  </span>
                  <span>
                    <span className="block font-semibold">{d.affichage}</span>
                    <span className="meta">Délégation de classe</span>
                  </span>
                </li>
              ))}
            </ul>
          )}
          {principal ? <p className="meta m-0 mt-4 border-t border-[color:var(--color-bordure)] pt-3">Professeur principal : {principal.affichage}</p> : null}
        </section>

        <section className="rounded-[var(--radius-carte)] bg-[color:var(--color-rose-clair)] p-5" aria-labelledby="aide">
          <h2 id="aide" className="titre-bloc m-0 font-bold">
            Besoin de parler à un adulte ?
          </h2>
          <p className="m-0 mt-2 text-[0.9375rem] text-[color:var(--color-encre-faible)]">
            Une question personnelle n&apos;a pas sa place dans le salon. Écris à un professeur qui t&apos;encadre : seule la personne destinataire la lit.
          </p>
          <Link href="/app/demandes/nouvelle" className="bouton bouton-primaire mt-4">
            <MessageSquareLock {...ICONE} /> Écrire à un adulte
          </Link>
        </section>

        <Link href="/app/bienvenue" className="carte-chiffre min-h-0 flex-row items-center">
          <TuileIcone icone={Users} />
          <span>
            <span className="block font-bold">Nouveau dans la classe ?</span>
            <span className="meta block">Trois repères pour démarrer.</span>
          </span>
        </Link>
      </div>
    </div>
  );
}
