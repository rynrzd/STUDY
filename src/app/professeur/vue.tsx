import Link from "next/link";
import { CalendarDays, ClipboardCheck, FilePen, FileText, MessageCircleQuestion, Plus, type LucideIcon } from "lucide-react";
import { EnTetePage, Etiquette, ICONE, Ligne, ListeLignes, TuileIcone, dateLisible } from "@/components/study/ui";
import type { devoirsDuProfesseur, seancesDuProfesseur } from "@/lib/espace-professeur";
import { echeanceLisible } from "@/lib/echeances";
import type { agenda } from "@/lib/v6/eleve";
import type { tableauProfesseur } from "@/lib/v6/professeur";

/** Vue de la page, rendue avec des données réelles (page.tsx) ou fictives (aperçu de développement). */
export function VueAccueilProfesseur({ prenom, organisation, tableau, priorites, semaine, questions, aujourdhui, libelles, brouillons, devoirsOuverts, publiees }: {
  prenom: string;
  organisation: string | null;
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
  return (
    <>
      <EnTetePage
        sourcil={organisation}
        titre={`Bonjour ${prenom}`}
        sousTitre="Ce qui attend une réponse, ce qui reste à préparer."
        actions={
          <Link href="/studio" className="bouton bouton-primaire">
            <Plus {...ICONE} /> Créer un cours
          </Link>
        }
      />

      {tableau.erreur ? (
        <p role="alert" className="m-0 mb-6 text-[color:var(--color-erreur)]">
          Certaines données n&apos;ont pas pu être chargées. Les compteurs peuvent être incomplets.
        </p>
      ) : null}

      <section aria-labelledby="classes">
        <h2 id="classes" className="titre-section mb-3">
          Mes classes
        </h2>
        <ul className="m-0 grid list-none gap-3 p-0 sm:grid-cols-2 xl:grid-cols-4">
          {tableau.cartes.map((c) => (
            <li key={c.id}>
              <Link href={c.salon ? `/app/messagerie/${c.salon}` : "/studio"} className="carte-chiffre">
                <TuileIcone icone={MessageCircleQuestion} />
                <span>
                  <span className="block font-bold">{c.classe}</span>
                  <span className="meta block">{c.matiere}</span>
                </span>
                <span className="mt-auto">
                  <span className="block text-[1.75rem] font-extrabold leading-none">{c.questionsSansReponse}</span>
                  <span className="meta">question{c.questionsSansReponse > 1 ? "s" : ""} sans réponse</span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <div className="mt-8 grid gap-6 lg:grid-cols-2">
        <section aria-labelledby="priorites">
          <h2 id="priorites" className="titre-section mb-3">
            À traiter en priorité
          </h2>
          <ListeLignes>
            {priorites.map((x) => (
              <Ligne key={x.libelle} href={x.href} icone={x.icone} titre={x.libelle} detail={x.detail} fin={<span className="nombre">{x.n}</span>} />
            ))}
          </ListeLignes>
        </section>
        <section aria-labelledby="agenda">
          <div className="mb-3 flex items-center justify-between gap-3">
            <h2 id="agenda" className="titre-section">
              Mon agenda
            </h2>
            <Link href="/app/agenda" className="text-[0.875rem] font-semibold text-[color:var(--color-accent)]">
              Voir tout
            </Link>
          </div>
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
      </div>

      <div id="questions" className="mt-8 scroll-mt-24">
        {questions}
      </div>

      <section className="mt-8" aria-labelledby="aujourdhui">
        <h2 id="aujourdhui" className="titre-section mb-3">
          Aujourd&apos;hui
        </h2>
        {aujourdhui.length === 0 ? (
          <p className="m-0 text-[color:var(--color-encre-faible)]">Aucune séance n&apos;est datée d&apos;aujourd&apos;hui. Vous pouvez en préparer une pour un autre jour depuis le Studio.</p>
        ) : (
          <ListeLignes>
            {aujourdhui.map((seance) => (
              <Ligne key={seance.id} href={`/studio/${seance.id}`} icone={FileText} titre={seance.title} detail={libelles.get(seance.teaching_space_id) ?? "Cours"} fin={etat(seance.state === "publiee")} />
            ))}
          </ListeLignes>
        )}
      </section>

      <div className="mt-8 grid gap-6 lg:grid-cols-2 lg:items-start">
        <section aria-labelledby="brouillons">
          <h2 id="brouillons" className="titre-section mb-3 flex items-center gap-2">
            Brouillons à terminer <span className="nombre">{brouillons.length}</span>
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
        <section aria-labelledby="devoirs">
          <h2 id="devoirs" className="titre-section mb-3 flex items-center gap-2">
            Devoirs en cours <span className="nombre">{devoirsOuverts.length}</span>
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
      </div>

      <section className="mt-8" aria-labelledby="publiees">
        <h2 id="publiees" className="titre-section mb-3">
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
    </>
  );
}
