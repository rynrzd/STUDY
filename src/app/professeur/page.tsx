import Link from "next/link";
import { redirect } from "next/navigation";
import { TitreEspace, Vide } from "@/components/app/Cadre";
import { jetonAccesDe, sessionCourante } from "@/lib/session-serveur";
import { coursDuProfesseur } from "@/lib/studio";
import { devoirsDuProfesseur, seancesDuProfesseur } from "@/lib/espace-professeur";
import { echeanceLisible, seancesDuJour } from "@/lib/echeances";
import { ChevronRight, CircleHelp, ClipboardCheck, Library } from "lucide-react";
import { QuestionsDesClasses } from "@/components/study/QuestionsDesClasses";
import { Panneau, dateLisible } from "@/components/study/ui";
import { agenda } from "@/lib/v6/eleve";
import { tableauProfesseur } from "@/lib/v6/professeur";

/**
 * Accueil du professeur — cahier V2, §8.1.
 *
 * L'écran répond à une seule question : « qu'est-ce que je prépare
 * maintenant ? ». Les séances du jour d'abord, les brouillons ensuite — parce
 * qu'un brouillon oublié est l'incident le plus coûteux du produit : la classe
 * arrive, et le cours n'est pas visible.
 */
export const dynamic = "force-dynamic";

export default async function PageProfesseur() {
  const personne = await sessionCourante();
  if (personne === null) redirect("/connexion");

  const jeton = await jetonAccesDe(personne);
  if (jeton === null) redirect("/connexion");

  const cours = await coursDuProfesseur(jeton);

  if (cours.length === 0) {
    return (
      <>
        <TitreEspace titre={`Bonjour ${personne.prenom}`} sousTitre={personne.organisation} />
        <div className="mt-8">
          <Vide
            titre="Aucun cours ne vous est encore affecté."
            texte="Vos cours apparaissent ici dès que l'administration de votre établissement vous affecte à une classe et à une matière. C'est elle qui réalise cette opération, depuis son espace."
          />
        </div>
      </>
    );
  }

  const maintenant = new Date();
  const [seances, devoirs, tableau, semaine] = await Promise.all([
    seancesDuProfesseur(jeton),
    devoirsDuProfesseur(jeton),
    tableauProfesseur(jeton, cours),
    agenda(jeton, maintenant, new Date(maintenant.getTime() + 7 * 86_400_000)),
  ]);
  const priorites = [
    { libelle: "Questions en attente", detail: "Questions d'élèves sans réponse dans vos salons", n: tableau.questionsEnAttente, href: "#questions", icone: CircleHelp },
    { libelle: "Copies à évaluer", detail: "Remises en attente de votre retour", n: tableau.copiesAEvaluer, href: "/professeur/devoirs", icone: ClipboardCheck },
    { libelle: "Réponses aux ateliers", detail: "Réponses d'élèves des sept derniers jours", n: tableau.reponsesAteliers, href: "/app/prof/ateliers", icone: Library },
  ];

  const libelles = new Map(cours.map((c) => [c.id, c.libelle] as const));
  const aujourdhui = seancesDuJour(seances);
  const brouillons = seances.filter((s) => s.state === "brouillon").slice(0, 8);
  const publiees = seances.filter((s) => s.state === "publiee").slice(0, 6);
  const devoirsOuverts = devoirs.filter((d) => d.state === "publiee").slice(0, 6);

  return (
    <>
      <TitreEspace
        titre={`Bonjour ${personne.prenom}`}
        sousTitre={personne.organisation}
        action={
          <Link href="/studio" className="bouton bouton-rose">
            Ouvrir le Studio
          </Link>
        }
      />

      {tableau.erreur ? (
        <p role="alert" className="m-0 mt-6 text-[color:var(--color-erreur)]">Certaines données n&apos;ont pas pu être chargées. Les compteurs peuvent être incomplets.</p>
      ) : null}

      {/* T01 — une carte par enseignement : questions sans réponse réelles. */}
      <ul className="m-0 mt-8 grid list-none gap-4 p-0 sm:grid-cols-2 xl:grid-cols-4">
        {tableau.cartes.map((c) => (
          <li key={c.id}>
            <Link
              href={c.salon ? `/app/messagerie/${c.salon}` : "/studio"}
              className="carte-souleve flex h-full flex-col rounded-[16px] bg-[color:var(--color-rose-clair)] p-5 no-underline"
            >
              <span className="font-semibold text-[color:var(--color-encre)]">{c.classe}</span>
              <span className="meta">{c.matiere}</span>
              <span className="mt-4 flex items-end justify-between gap-2">
                <span>
                  <span className="block font-[family-name:var(--font-titre)] text-[2rem] font-bold leading-none text-[color:var(--color-encre)]">{c.questionsSansReponse}</span>
                  <span className="meta">question{c.questionsSansReponse > 1 ? "s" : ""} sans réponse</span>
                </span>
                <ChevronRight size={18} strokeWidth={1.75} aria-hidden="true" className="text-[color:var(--color-encre-faible)]" />
              </span>
            </Link>
          </li>
        ))}
      </ul>

      <div className="mt-6 grid gap-6 lg:grid-cols-2">
        <Panneau titre="À traiter en priorité">
          <ul className="m-0 list-none p-0">
            {priorites.map((x) => (
              <li key={x.libelle}>
                <Link href={x.href} className="ligne no-underline">
                  <x.icone size={20} strokeWidth={1.75} aria-hidden="true" className="shrink-0 text-[color:var(--color-accent)]" />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-center gap-2 font-semibold text-[color:var(--color-encre)]">
                      {x.libelle}
                      <span className="etiquette-etat" data-ton="rose">{x.n}</span>
                    </span>
                    <span className="meta">{x.detail}</span>
                  </span>
                  <ChevronRight size={18} strokeWidth={1.75} aria-hidden="true" />
                </Link>
              </li>
            ))}
          </ul>
        </Panneau>
        <Panneau titre="Mon agenda" action={<Link href="/app/agenda" className="lien-fleche text-[0.8125rem]">Voir tout</Link>}>
          {semaine === null ? (
            <p className="m-0 text-[color:var(--color-erreur)]">L&apos;agenda n&apos;a pas pu être chargé.</p>
          ) : semaine.length === 0 ? (
            <p className="m-0 text-[color:var(--color-encre-faible)]">Rien de prévu dans les sept prochains jours.</p>
          ) : (
            <ul className="m-0 list-none p-0">
              {semaine.slice(0, 4).map((e) => (
                <li key={`${e.kind}-${e.id}`} className="ligne items-start">
                  <span className="min-w-0 flex-1">
                    <span className="sourcil mb-0.5">{dateLisible(e.debut, { weekday: "short", day: "numeric", hour: "2-digit", minute: "2-digit" })}</span>
                    <span className="block font-semibold">{e.titre}</span>
                    {e.contexte ? <span className="meta">{e.contexte}</span> : null}
                  </span>
                </li>
              ))}
            </ul>
          )}
        </Panneau>
      </div>

      <div id="questions" className="mt-6 scroll-mt-24">
        <QuestionsDesClasses jeton={jeton} />
      </div>

      <section className="mt-9">
        <h2 className="text-[length:var(--text-h2-app)] leading-[var(--text-h2-app--line-height)]">
          Aujourd&apos;hui
        </h2>

        {aujourdhui.length === 0 ? (
          <p className="m-0 mt-3 max-w-[var(--spacing-lecture)] text-[color:var(--color-encre-faible)]">
            Aucune séance n&apos;est datée d&apos;aujourd&apos;hui. Vous pouvez en
            préparer une pour un autre jour depuis le Studio.
          </p>
        ) : (
          <ul className="m-0 mt-4 grid list-none gap-3 p-0 sm:grid-cols-2">
            {aujourdhui.map((seance) => (
              <li key={seance.id}>
                <Link href={`/studio/${seance.id}`} className="carte block p-5 no-underline">
                  <span className="flex items-start justify-between gap-3">
                    <span className="font-semibold text-[color:var(--color-encre)]">
                      {seance.title}
                    </span>
                    <span
                      className={`pastille ${
                        seance.state === "publiee" ? "pastille-publie" : "pastille-brouillon"
                      }`}
                    >
                      {seance.state === "publiee" ? "Publiée" : "Brouillon"}
                    </span>
                  </span>
                  <span className="mt-1.5 block text-[length:var(--text-tableau)] text-[color:var(--color-encre-faible)]">
                    {libelles.get(seance.teaching_space_id) ?? "Cours"}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="mt-11 grid gap-11 lg:grid-cols-2 lg:items-start">
        <Colonne titre="Brouillons à terminer" vide="Aucun brouillon en attente.">
          {brouillons.map((seance) => (
            <Ligne
              key={seance.id}
              href={`/studio/${seance.id}`}
              titre={seance.title}
              detail={libelles.get(seance.teaching_space_id) ?? "Cours"}
              marque={<span className="pastille pastille-brouillon">Brouillon</span>}
            />
          ))}
        </Colonne>

        <Colonne titre="Devoirs en cours" vide="Aucun devoir donné pour l'instant.">
          {devoirsOuverts.map((devoir) => (
            <Ligne
              key={devoir.id}
              href="/professeur/devoirs"
              titre={devoir.title}
              detail={libelles.get(devoir.teaching_space_id) ?? "Cours"}
              marque={
                <span className="text-[length:var(--text-aide)] text-[color:var(--color-encre-faible)]">
                  {echeanceLisible(devoir.due_at)}
                </span>
              }
            />
          ))}
        </Colonne>
      </div>

      <section className="mt-11">
        <h2 className="text-[length:var(--text-h2-app)] leading-[var(--text-h2-app--line-height)]">
          Dernières séances publiées
        </h2>
        {publiees.length === 0 ? (
          <p className="m-0 mt-3 max-w-[var(--spacing-lecture)] text-[color:var(--color-encre-faible)]">
            Rien n&apos;est encore publié. Tant qu&apos;une séance reste un
            brouillon, vos élèves ne la voient pas.
          </p>
        ) : (
          <ul className="m-0 mt-3 list-none p-0">
            {publiees.map((seance) => (
              <Ligne
                key={seance.id}
                href={`/studio/${seance.id}`}
                titre={seance.title}
                detail={libelles.get(seance.teaching_space_id) ?? "Cours"}
                marque={<span className="pastille pastille-publie">Publiée</span>}
              />
            ))}
          </ul>
        )}
      </section>
    </>
  );
}

/* -------------------------------------------------------------------------- */

function Colonne({
  titre,
  vide,
  children,
}: {
  titre: string;
  vide: string;
  children: React.ReactNode[];
}) {
  return (
    <section>
      <h2 className="text-[length:var(--text-h2-app)] leading-[var(--text-h2-app--line-height)]">
        {titre}
      </h2>
      {children.length === 0 ? (
        <p className="m-0 mt-3 text-[color:var(--color-encre-faible)]">{vide}</p>
      ) : (
        <ul className="m-0 mt-3 list-none p-0">{children}</ul>
      )}
    </section>
  );
}

function Ligne({
  href,
  titre,
  detail,
  marque,
}: {
  href: string;
  titre: string;
  detail: string;
  marque: React.ReactNode;
}) {
  return (
    <li>
      <Link
        href={href}
        className="flex min-h-[var(--spacing-cible)] flex-wrap items-center justify-between gap-3 border-b border-[color:var(--color-bordure)] px-1 py-3 no-underline transition-colors hover:bg-[color:var(--color-survol)]"
      >
        <span className="min-w-0">
          <span className="block truncate font-medium text-[color:var(--color-encre)]">{titre}</span>
          <span className="mt-0.5 block text-[length:var(--text-aide)] text-[color:var(--color-encre-faible)]">
            {detail}
          </span>
        </span>
        {marque}
      </Link>
    </li>
  );
}
