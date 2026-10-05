import Link from "next/link";
import { redirect } from "next/navigation";
import { ArrowRight, CalendarDays, HandHelping, Lightbulb, MessageCircle } from "lucide-react";
import { CaseFaite } from "@/components/app/CaseFaite";
import { DateBloc, EnTetePage, Etiquette, EtatVide, ICONE, Panneau, dateLisible } from "@/components/study/ui";
import { echeanceLisible, trierDevoirs } from "@/lib/echeances";
import { devoirsDeLEleve, coursDeLEleve } from "@/lib/espace-eleve";
import { travauxFaits } from "@/lib/parcours-eleve";
import { contexteApp } from "@/lib/v6/contexte";
import { agenda, decrireNotification, notifications, revisionsCollectives, seanceAReprendre } from "@/lib/v6/eleve";
import { suggestionsDeRevision } from "@/lib/v6/revision";

export const metadata = { title: "Aujourd'hui" };
export const dynamic = "force-dynamic";

/**
 * E01 — Aujourd'hui. Une prochaine action utile, sans surcharge : reprendre,
 * deux priorités, la semaine, la classe. Aucun score, aucune fausse
 * progression : ce qui est affiché vient des données de l'élève.
 */
export default async function PageAujourdhui() {
  const ctx = await contexteApp();
  if (!ctx.roles.eleve) {
    if (ctx.roles.professeur) redirect("/professeur");
    if (ctx.roles.admin) redirect("/admin");
    redirect("/app/reglages");
  }

  const maintenant = new Date();
  const dans7 = new Date(maintenant.getTime() + 7 * 86_400_000);
  const [reprise, devoirs, faits, cours, semaine, nouvelles, revision, entraide, preferences] = await Promise.all([
    seanceAReprendre(ctx.jeton),
    devoirsDeLEleve(ctx.jeton),
    travauxFaits(ctx.jeton),
    coursDeLEleve(ctx.jeton),
    agenda(ctx.jeton, maintenant, dans7),
    notifications(ctx.jeton, { limite: 6 }),
    suggestionsDeRevision(ctx.jeton, { limite: 1 }),
    revisionsCollectives(ctx.jeton, ctx.classeActive?.classe),
    import("@/lib/supabase-serveur").then(({ clientUtilisateur }) =>
      clientUtilisateur(ctx.jeton).from("preferences_notifications").select("bienvenue_faite").maybeSingle(),
    ),
  ]);

  const libelles = new Map(cours.map((c) => [c.id, c.matiere] as const));
  const priorites = trierDevoirs(devoirs).aVenir.filter((d) => !faits.has(d.id)).slice(0, 2);
  const heure = Number(new Intl.DateTimeFormat("fr-FR", { hour: "numeric", hour12: false, timeZone: "Europe/Paris" }).format(maintenant));
  const salut = heure >= 18 || heure < 5 ? "Bonsoir" : "Bonjour";
  const premiereVisite = reprise?.dejaLue !== true && preferences.data?.bienvenue_faite !== true;
  const suggestion = revision.suggestions[0];
  const classe = (nouvelles ?? []).filter((n) => ["reponse_fil", "annonce", "consultation_ouverte"].includes(n.genre)).slice(0, 3);

  return (
    <>
      <EnTetePage
        sourcil={dateLisible(maintenant.toISOString(), { weekday: "long", day: "numeric", month: "long" })}
        titre={`${salut} ${ctx.personne.prenom}`}
        sousTitre="Une chose à la fois. Tout ce qu'il te faut est ici."
        actions={
          <Link href="/app/agenda" className="bouton bouton-secondaire">
            <CalendarDays {...ICONE} /> Mon agenda
          </Link>
        }
      />

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.65fr)_minmax(280px,1fr)]">
        <div className="grid content-start gap-6">
          {premiereVisite ? (
            <section className="panneau panneau-rose">
              <span className="sourcil">Bienvenue</span>
              <h2 className="titre-section max-w-[24ch] text-[1.5rem] leading-[1.3]">Trois repères pour bien démarrer.</h2>
              <p className="m-0 mt-2 max-w-[48ch] text-[color:var(--color-accent-fonce)]">
                Tes cours, ta classe et tes échéances, en deux minutes. Tu peux passer cette étape.
              </p>
              <div className="mt-5 flex flex-wrap items-center gap-3">
                <Link href="/app/bienvenue" className="bouton bouton-primaire">
                  Commencer <ArrowRight {...ICONE} className="fleche" />
                </Link>
              </div>
            </section>
          ) : reprise ? (
            <section className="panneau panneau-rose" aria-labelledby="reprendre">
              <span className="sourcil">{reprise.dejaLue ? "Ton prochain petit pas" : "Nouveau cours"}</span>
              <h2 id="reprendre" className="titre-section max-w-[26ch] text-[1.5rem] leading-[1.3]">
                {reprise.seance.titre}
              </h2>
              {reprise.seance.objectif ? (
                <p className="m-0 mt-2 max-w-[48ch] text-[color:var(--color-accent-fonce)]">{reprise.seance.objectif}</p>
              ) : null}
              <div className="mt-5 flex flex-wrap items-center gap-3">
                <Link href={`/app/seances/${reprise.seance.id}`} className="bouton bouton-primaire">
                  {reprise.dejaLue ? "Reprendre ma séance" : "Ouvrir la séance"} <ArrowRight {...ICONE} className="fleche" />
                </Link>
                <span className="meta">
                  {[reprise.seance.cours, reprise.seance.chapitre].filter(Boolean).join(" · ")}
                </span>
              </div>
            </section>
          ) : (
            <EtatVide
              titre="Aucune séance publiée pour l'instant"
              texte="Dès qu'un professeur publiera une séance dans l'une de tes classes, elle apparaîtra ici."
            />
          )}

          <Panneau
            id="a-faire"
            titre="À faire, sans te disperser"
            action={
              <Link href="/app/devoirs" className="lien-fleche text-[0.8125rem]">
                Tout voir
              </Link>
            }
          >
            {priorites.length === 0 ? (
              <p className="m-0 text-[color:var(--color-encre-faible)]">Rien à rendre pour le moment.</p>
            ) : (
              <ul className="m-0 list-none p-0">
                {priorites.map((d) => (
                  <li key={d.id} className="ligne">
                    {d.due_at ? <DateBloc date={d.due_at} /> : null}
                    <Link href={`/app/devoirs/${d.id}`} className="min-w-0 flex-1 no-underline">
                      <span className="titre-bloc block truncate font-semibold text-[color:var(--color-encre)]">{d.title}</span>
                      <span className="meta block">
                        {libelles.get(d.teaching_space_id) ?? "Cours"} · {echeanceLisible(d.due_at)}
                      </span>
                    </Link>
                    <CaseFaite devoir={d.id} fait={false} libelle={d.title} />
                  </li>
                ))}
              </ul>
            )}
          </Panneau>

          <Panneau
            id="classe"
            titre="Ta classe avance aussi"
            action={
              <Link href="/app/classe" className="lien-fleche text-[0.8125rem]">
                Voir ma classe
              </Link>
            }
          >
            {classe.length === 0 ? (
              <p className="m-0 text-[color:var(--color-encre-faible)]">
                Pas de nouvelle de ta classe depuis ta dernière visite.{" "}
                <Link href="/app/messagerie">Ouvrir la messagerie</Link>
              </p>
            ) : (
              <ul className="m-0 list-none p-0">
                {classe.map((n) => {
                  const d = decrireNotification(n);
                  return (
                    <li key={n.id} className="ligne">
                      <span className="avatar" aria-hidden="true">
                        <MessageCircle size={16} strokeWidth={1.75} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-semibold">{d.titre}</span>
                        <span className="meta">{d.sujet} · {dateLisible(n.survenuLe, { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" })}</span>
                      </span>
                      <Link href={d.lien} className="lien-fleche text-[0.8125rem]">
                        Lire
                      </Link>
                    </li>
                  );
                })}
              </ul>
            )}
          </Panneau>
        </div>

        <div className="grid content-start gap-6">
          <Panneau id="semaine" titre="Cette semaine">
            {semaine === null ? (
              <p className="m-0 text-[color:var(--color-erreur)]">L&apos;agenda n&apos;a pas pu être chargé.</p>
            ) : semaine.length === 0 ? (
              <p className="m-0 text-[color:var(--color-encre-faible)]">Rien de prévu dans les sept prochains jours.</p>
            ) : (
              <ul className="m-0 list-none p-0">
                {semaine.slice(0, 5).map((e) => (
                  <li key={`${e.kind}-${e.id}`} className="ligne items-start">
                    <span className="min-w-0 flex-1">
                      <span className="sourcil mb-1">{dateLisible(e.debut, { weekday: "short", day: "numeric" })}</span>
                      <span className="block font-semibold">{e.titre}</span>
                      <span className="meta">
                        {LIBELLE_AGENDA[e.kind] ?? e.kind}
                        {e.contexte ? ` · ${e.contexte}` : ""}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
            <Link href="/app/agenda" className="bouton bouton-secondaire mt-4 w-full">
              Organiser ma semaine
            </Link>
          </Panneau>

          {suggestion ? (
            <Panneau id="pourquoi" titre="Pourquoi cette révision ?">
              <p className="m-0 font-semibold">{suggestion.notion}</p>
              <p className="meta m-0 mt-1">{suggestion.cours}</p>
              <p className="m-0 mt-3 flex gap-2 text-[0.8125rem]">
                <Lightbulb size={18} strokeWidth={1.75} aria-hidden="true" className="shrink-0 text-[color:var(--color-accent)]" />
                {suggestion.explication}
              </p>
              <div className="mt-4 flex flex-wrap gap-2">
                <Link href="/app/reviser" className="bouton bouton-secondaire">
                  Réviser maintenant
                </Link>
                <Etiquette ton="rose">Suggestion, pas une obligation</Etiquette>
              </div>
            </Panneau>
          ) : null}

          <section className="panneau panneau-vert" aria-labelledby="entraide">
            <span className="sourcil text-[color:var(--color-succes)]">Apprendre ensemble</span>
            <h2 id="entraide" className="titre-section">
              Une question ? Ta classe est là.
            </h2>
            <p className="m-0 mt-2 text-[color:var(--color-encre-faible)]">
              {entraide.length > 0
                ? `${entraide.length} révision${entraide.length > 1 ? "s" : ""} collective${entraide.length > 1 ? "s" : ""} prévue${entraide.length > 1 ? "s" : ""} dans ta classe.`
                : "Retrouve les explications de ta classe ou demande un coup de main."}
            </p>
            <div className="mt-4 flex flex-wrap gap-2">
              <Link href="/app/aide" className="bouton bouton-secondaire">
                <HandHelping {...ICONE} /> Débloque-moi
              </Link>
              <Link href="/app/classe?onglet=entraide" className="bouton bouton-discret">
                Voir l&apos;entraide
              </Link>
            </div>
          </section>
        </div>
      </div>
    </>
  );
}

const LIBELLE_AGENDA: Record<string, string> = {
  controle: "Contrôle",
  rendu: "À rendre",
  cours: "Cours",
  revision: "Révision",
  creneau: "Créneau personnel",
  vie_de_classe: "Vie de classe",
};
