import Link from "next/link";
import { ArrowRight, BarChart3, HandHelping, Lightbulb, MessageSquareLock, Users } from "lucide-react";
import { FormulaireRevisionCollective } from "@/components/study/classe-formulaires";
import { Etiquette, ICONE, Panneau, dateHeure, dateLisible } from "@/components/study/ui";
import { contexteApp } from "@/lib/v6/contexte";
import { consultations, decisions, droits as lireDroits, membres, STATUTS_DECISION } from "@/lib/v6/classe";
import { revisionsCollectives } from "@/lib/v6/eleve";

export const metadata = { title: "Ma classe" };
export const dynamic = "force-dynamic";

/**
 * E10 — Ma classe : la consultation du moment, les suites données aux idées,
 * les délégués, l'entraide. Tous les compteurs viennent de données autorisées
 * pour cette personne et cette classe, jamais d'un filtre côté client.
 */
export default async function PageClasse({ params }: { params: Promise<{ classe: string }> }) {
  const ctx = await contexteApp();
  const { classe } = await params;
  const [lesConsultations, lesDecisions, lesMembres, entraide, droits] = await Promise.all([
    consultations(ctx.jeton, classe),
    decisions(ctx.jeton, classe),
    membres(ctx.jeton, classe),
    revisionsCollectives(ctx.jeton, classe),
    lireDroits(ctx.jeton, classe),
  ]);
  const ouverte = lesConsultations.find((c) => c.etat === "ouverte" && c.fermeLe !== null && new Date(c.fermeLe) > new Date());
  const delegues = (lesMembres ?? []).filter((m) => m.role === "delegue");
  const principal = (lesMembres ?? []).find((m) => m.role === "professeur_principal");
  const suivies = lesDecisions.filter((d) => d.publiee).slice(0, 6);

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(0,1.6fr)_minmax(280px,1fr)]">
      <div className="grid content-start gap-6">
        {ouverte ? (
          <section className="panneau panneau-rose" aria-labelledby="consultation">
            <span className="sourcil">
              <BarChart3 size={14} strokeWidth={1.75} aria-hidden="true" className="mr-1.5 inline" />
              Consultation du mois
            </span>
            <h2 id="consultation" className="titre-section text-[1.5rem] leading-[1.3]">
              Ta voix compte.
            </h2>
            <p className="m-0 mt-2 max-w-[48ch] text-[color:var(--color-accent-fonce)]">
              {ouverte.titre} — ouverte jusqu&apos;au {dateLisible(ouverte.fermeLe, { weekday: "long", day: "numeric", month: "long" })}.
            </p>
            <Link href={`/app/classes/${classe}/consultations/${ouverte.id}`} className="bouton bouton-primaire mt-5">
              {droits.eleve ? "Donner mon avis" : "Voir la consultation"} <ArrowRight {...ICONE} className="fleche" />
            </Link>
          </section>
        ) : (
          <section className="panneau" aria-labelledby="consultation">
            <h2 id="consultation" className="titre-section">
              Consultation
            </h2>
            <p className="m-0 mt-2 text-[color:var(--color-encre-faible)]">
              Aucune consultation ouverte en ce moment.
              {droits.delegue || droits.principal ? " Vous pouvez en préparer une depuis le bureau des délégués." : " Les délégués t'inviteront à la prochaine."}
            </p>
          </section>
        )}

        <Panneau id="suites" titre="Vos idées, leurs suites">
          {suivies.length === 0 ? (
            <p className="m-0 text-[color:var(--color-encre-faible)]">Aucun sujet suivi pour l&apos;instant.</p>
          ) : (
            <ul className="m-0 list-none p-0">
              {suivies.map((d) => (
                <li key={d.id} id={`decision-${d.id}`} className="ligne items-start">
                  <Lightbulb size={20} strokeWidth={1.75} aria-hidden="true" className="mt-0.5 shrink-0 text-[color:var(--color-accent)]" />
                  <span className="min-w-0 flex-1">
                    <span className="block font-semibold">{d.titre}</span>
                    {d.explication ? <span className="meta block">{d.explication}</span> : null}
                    {d.statut === "refusee" && d.motif ? <span className="meta block">Motif : {d.motif}</span> : null}
                    {d.statut === "en_cours" ? (
                      <span className="meta block">
                        Suivi par {d.responsable} · point prévu le {dateLisible(d.suiviLe)}
                      </span>
                    ) : null}
                  </span>
                  <Etiquette ton={STATUTS_DECISION[d.statut]?.ton ?? "neutre"}>{STATUTS_DECISION[d.statut]?.libelle ?? d.statut}</Etiquette>
                </li>
              ))}
            </ul>
          )}
        </Panneau>

        <Panneau id="entraide" titre="Réviser ensemble">
          {entraide.length === 0 ? (
            <p className="m-0 text-[color:var(--color-encre-faible)]">Aucune séance d&apos;entraide prévue. Propose-en une : la participation est volontaire.</p>
          ) : (
            <ul className="m-0 list-none p-0">
              {entraide.map((r) => (
                <li key={r.id} className="ligne">
                  <HandHelping {...ICONE} className="shrink-0 text-[color:var(--color-succes)]" />
                  <Link href={`/app/entraide/${r.id}`} className="min-w-0 flex-1 no-underline">
                    <span className="block font-semibold text-[color:var(--color-encre)]">{r.titre}</span>
                    <span className="meta">{dateHeure(r.debut)} · {r.capacite} places</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
          {droits.membre ? (
            <details className="mt-4">
              <summary className="cursor-pointer font-semibold text-[color:var(--color-accent)]">Proposer une séance d&apos;entraide</summary>
              <div className="mt-4">
                <FormulaireRevisionCollective classe={classe} />
              </div>
            </details>
          ) : null}
        </Panneau>
      </div>

      <div className="grid content-start gap-6">
        <Panneau
          id="delegues"
          titre="Vos délégués"
          action={
            <Link href={`/app/classes/${classe}/membres`} className="lien-fleche text-[0.8125rem]">
              Voir tout
            </Link>
          }
        >
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
          {principal ? <p className="meta m-0 mt-4">Professeur principal : {principal.affichage}</p> : null}
        </Panneau>

        <Panneau id="aide" titre="Besoin de parler à un adulte ?">
          <p className="m-0 text-[color:var(--color-encre-faible)]">
            Une question personnelle n&apos;a pas sa place dans le salon. Écris directement à un professeur qui t&apos;encadre : seule la personne
            destinataire la lit.
          </p>
          <Link href="/app/demandes/nouvelle" className="bouton bouton-secondaire mt-4">
            <MessageSquareLock {...ICONE} /> Écrire à un adulte
          </Link>
        </Panneau>

        <Panneau id="accueil" titre="Nouveau dans la classe ?">
          <p className="m-0 text-[color:var(--color-encre-faible)]">Trois repères pour démarrer : tes cours, ta classe, tes échéances.</p>
          <Link href="/app/bienvenue" className="bouton bouton-discret mt-3">
            <Users {...ICONE} /> Parcours d&apos;accueil
          </Link>
        </Panneau>
      </div>
    </div>
  );
}
