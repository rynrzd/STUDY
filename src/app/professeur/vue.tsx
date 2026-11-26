import Link from "next/link";
import { CalendarDays, ClipboardCheck, ClipboardList, FilePen, FileText, FileUp, MessageCircleQuestion, Plus, type LucideIcon } from "lucide-react";
import { EnTetePage, Etiquette, ICONE, Ligne, ListeLignes, TuileIcone, dateLisible } from "@/components/study/ui";
import type { devoirsDuProfesseur, seancesDuProfesseur } from "@/lib/espace-professeur";
import { echeanceLisible } from "@/lib/echeances";
import type { agenda } from "@/lib/v6/eleve";
import type { tableauProfesseur } from "@/lib/v6/professeur";
import { BandeauPremiersPas } from "./GuideDemarrage";

/** Vue de la page, rendue avec des données réelles (page.tsx) ou fictives (aperçu de développement). */
export function VueAccueilProfesseur({ prenom, organisation, cours = [], tableau, priorites, semaine, questions, aujourdhui, libelles, brouillons, devoirsOuverts, publiees }: {
  prenom: string;
  organisation: string | null;
  cours?: readonly { id: string; libelle: string }[];
  tableau: Awaited<ReturnType<typeof tableauProfesseur>>;
  priorites: readonly { libelle: string; detail: string; n: number; href: string; icone: LucideIcon }[];
  semaine: Awaited<ReturnType<typeof agenda>>;
  questions: React.ReactNode;
  aujourdhui: Awaited<ReturnType<typeof seancesDuProfesseur>>;
  libelles: Map<string, string>;
  brouillons: Awaited<ReturnType<typeof seancesDuProfesseur>>;
  devoirsOuverts: Awaited<ReturnType<typeof devoirsDuProfesseur>>;
  publiees: Awaited<ReturnType<typeof seancesDuProfesseur>>;
}) {
  const etat = (publiee: boolean) => <Etiquette ton={publiee ? "succes" : "attention"}>{publiee ? "Publiée" : "Brouillon"}</Etiquette>;
  const aUneSeance = brouillons.length > 0 || publiees.length > 0;
  const activite = aUneSeance || devoirsOuverts.length > 0 || aujourdhui.length > 0 ||
    priorites.some((priorite) => priorite.n > 0) || (semaine?.length ?? 0) > 0;
  return (
    <>
      <EnTetePage
        sourcil={organisation}
        titre={`Bonjour ${prenom}`}
        sousTitre="Ce qui attend une réponse, ce qui reste à préparer."
        actions={
          <Link href="/studio" className="bouton bouton-primaire">
            <Plus {...ICONE} /> Préparer un cours
          </Link>
        }
      />

      {!publiees.length ? <BandeauPremiersPas aUneSeance={aUneSeance} /> : null}

      {cours.length > 0 ? (
        <section aria-label="Accès à mes classes" className="mb-6 flex flex-wrap items-center gap-2.5">
          <span className="mr-1 text-sm font-semibold text-[color:var(--color-encre-faible)]">Mes classes</span>
          {cours.map((cours) => (
            <Link key={cours.id} href={`/professeur/classes`} className="inline-flex min-h-10 items-center rounded-full border border-[color:var(--color-bordure)] bg-[color:var(--color-surface)] px-4 text-sm font-semibold text-[color:var(--color-encre)] no-underline hover:border-[color:var(--color-accent)]">
              {cours.libelle}
            </Link>
          ))}
          <Link href="/professeur/classes" className="ml-1 text-sm font-bold text-[color:var(--color-accent)]">Gérer mes classes</Link>
        </section>
      ) : null}

      {tableau.erreur ? (
        <p role="alert" className="m-0 mb-6 text-[color:var(--color-erreur)]">
          Certaines données n&apos;ont pas pu être chargées. Les compteurs peuvent être incomplets.
        </p>
      ) : null}

      {/* Les quatre gestes du métier, nommés comme dans le menu : on part
          d'ici sans avoir à savoir où chaque chose se range. */}
      <section aria-labelledby="que-faire" className="mb-6">
        <h2 id="que-faire" className="titre-section mb-3">
          Que voulez-vous faire ?
        </h2>
        <ul className="m-0 grid list-none gap-3 p-0 sm:grid-cols-2 xl:grid-cols-4">
          {[
            { href: "/studio", titre: "Préparer une séance", detail: "Écrire, ajouter un document, publier", Icone: FilePen, n: null },
            { href: "/professeur/studio", titre: "Importer un document", detail: "Un PDF ou un Word que vous avez déjà", Icone: FileUp, n: null },
            { href: "/professeur/devoirs", titre: "Corriger les copies", detail: "Devoirs rendus en attente de retour", Icone: ClipboardCheck, n: tableau.copiesAEvaluer },
            { href: "/professeur/evaluations", titre: "Créer une évaluation", detail: "Questionnaire ou contrôle en ligne", Icone: ClipboardList, n: null },
          ].map(({ href, titre, detail, Icone, n }) => (
            <li key={href}>
              <Link href={href} className="carte-chiffre carte-souleve min-h-0">
                <span className="flex items-center justify-between gap-2">
                  <TuileIcone icone={Icone} />
                  {n ? <span className="nombre">{n}</span> : null}
                </span>
                <span className="font-bold">{titre}</span>
                <span className="meta">{detail}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      {/* Les statistiques n'arrivent qu'après la première activité : à ce
          stade, des colonnes de zéros n'aident pas le professeur à démarrer. */}
      {activite ? <div className="bento">
        <section aria-labelledby="priorites" className="bento-carte lg-7 md-6">
          <h2 id="priorites" className="bento-titre">
            À traiter en priorité
          </h2>
          <ListeLignes>
            {priorites.map((x) => (
              <Ligne key={x.libelle} href={x.href} icone={x.icone} titre={x.libelle} detail={x.detail} fin={<span className="nombre">{x.n}</span>} />
            ))}
          </ListeLignes>
        </section>

        <section aria-labelledby="agenda" className="bento-carte lg-5 md-6">
          <h2 id="agenda" className="bento-titre">
            Mon agenda
            <Link href="/app/agenda" className="text-[0.875rem] font-semibold text-[color:var(--color-accent)]">
              Voir tout
            </Link>
          </h2>
          {semaine === null ? (
            <p className="m-0 text-[color:var(--color-erreur)]">L&apos;agenda n&apos;a pas pu être chargé.</p>
          ) : semaine.length === 0 ? (
            <p className="m-0 text-[color:var(--color-encre-faible)]">Rien de prévu dans les sept prochains jours.</p>
          ) : (
            <ListeLignes>
              {semaine.slice(0, 4).map((e) => (
                <Ligne
                  key={`${e.kind}-${e.id}`}
                  icone={CalendarDays}
                  titre={e.titre}
                  detail={`${dateLisible(e.debut, { weekday: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}${e.contexte ? ` · ${e.contexte}` : ""}`}
                />
              ))}
            </ListeLignes>
          )}
        </section>

        <h2 id="classes" className="titre-section m-0 mt-2 md-6 lg-12">
          Mes classes
        </h2>
        {tableau.cartes.map((c) => (
          <Link key={c.id} href={c.salon ? `/app/messagerie/${c.salon}` : "/studio"} className="carte-chiffre md-3 lg-3" aria-describedby="classes">
            <TuileIcone icone={MessageCircleQuestion} />
            <span>
              <span className="block font-bold">{c.classe}</span>
              <span className="meta block">{c.matiere}</span>
            </span>
            <span className="mt-auto">
              <span className="bento-chiffre block">{c.questionsSansReponse}</span>
              <span className="meta">question{c.questionsSansReponse > 1 ? "s" : ""} sans réponse</span>
            </span>
          </Link>
        ))}

        <div id="questions" className="scroll-mt-24 md-6 lg-12">
          {questions}
        </div>

        <section aria-labelledby="aujourdhui" className="bento-carte lg-12 md-6" data-ton="rose">
          <h2 id="aujourdhui" className="bento-titre">
            Aujourd&apos;hui
          </h2>
          {aujourdhui.length === 0 ? (
            <p className="m-0 text-[color:var(--color-encre-faible)]">Aucune séance n&apos;est datée d&apos;aujourd&apos;hui. Vous pouvez en préparer une pour un autre jour depuis « Mes cours ».</p>
          ) : (
            <ListeLignes>
              {aujourdhui.map((seance) => (
                <Ligne key={seance.id} href={`/studio/${seance.id}`} icone={FileText} titre={seance.title} detail={libelles.get(seance.teaching_space_id) ?? "Cours"} fin={etat(seance.state === "publiee")} />
              ))}
            </ListeLignes>
          )}
        </section>

        <section aria-labelledby="brouillons" className="bento-carte lg-6 md-6">
          <h2 id="brouillons" className="bento-titre">
            <span className="flex items-center gap-2">
              Brouillons à terminer <span className="nombre">{brouillons.length}</span>
            </span>
          </h2>
          {brouillons.length === 0 ? (
            <p className="m-0 text-[color:var(--color-encre-faible)]">Aucun brouillon en attente.</p>
          ) : (
            <ListeLignes>
              {brouillons.map((seance) => (
                <Ligne key={seance.id} href={`/studio/${seance.id}`} icone={FilePen} titre={seance.title} detail={libelles.get(seance.teaching_space_id) ?? "Cours"} fin={etat(false)} />
              ))}
            </ListeLignes>
          )}
        </section>

        <section aria-labelledby="devoirs" className="bento-carte lg-6 md-6">
          <h2 id="devoirs" className="bento-titre">
            <span className="flex items-center gap-2">
              Devoirs en cours <span className="nombre">{devoirsOuverts.length}</span>
            </span>
          </h2>
          {devoirsOuverts.length === 0 ? (
            <p className="m-0 text-[color:var(--color-encre-faible)]">Aucun devoir donné pour l&apos;instant.</p>
          ) : (
            <ListeLignes>
              {devoirsOuverts.map((devoir) => (
                <Ligne
                  key={devoir.id}
                  href="/professeur/devoirs"
                  icone={ClipboardCheck}
                  titre={devoir.title}
                  detail={libelles.get(devoir.teaching_space_id) ?? "Cours"}
                  fin={<span className="meta">{echeanceLisible(devoir.due_at)}</span>}
                />
              ))}
            </ListeLignes>
          )}
        </section>

        <section aria-labelledby="publiees" className="bento-carte lg-12 md-6">
          <h2 id="publiees" className="bento-titre">
            Dernières séances publiées
          </h2>
          {publiees.length === 0 ? (
            <p className="m-0 text-[color:var(--color-encre-faible)]">Rien n&apos;est encore publié. Tant qu&apos;une séance reste un brouillon, vos élèves ne la voient pas.</p>
          ) : (
            <ListeLignes>
              {publiees.map((seance) => (
                <Ligne key={seance.id} href={`/studio/${seance.id}`} icone={FileText} titre={seance.title} detail={libelles.get(seance.teaching_space_id) ?? "Cours"} fin={etat(true)} />
              ))}
            </ListeLignes>
          )}
        </section>
      </div> : (
        <div className="rounded-2xl border border-[color:var(--color-bordure)] bg-[color:var(--color-surface)] p-6 sm:p-8">
          <h2 className="m-0 text-lg font-bold">Tout est prêt pour ton premier cours.</h2>
          <p className="mt-2 max-w-2xl text-sm leading-6 text-[color:var(--color-encre-faible)]">
            Dès que tu auras préparé une séance ou donné un devoir, tu retrouveras ici tes brouillons,
            les prochaines dates et les réponses de tes élèves. Pour l&apos;instant, pas besoin de surveiller des chiffres.
          </p>
          <Link href="/professeur/demarrage" className="font-bold text-[color:var(--color-accent)]">Revoir les étapes pour bien commencer</Link>
        </div>
      )}
    </>
  );
}
