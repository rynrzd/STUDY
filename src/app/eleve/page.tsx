import Link from "next/link";
import { redirect } from "next/navigation";
import { TitreEspace, Vide } from "@/components/app/Cadre";
import { jetonAccesDe, sessionCourante } from "@/lib/session-serveur";
import { echeanceLisible, seancesDuJour, trierDevoirs } from "@/lib/echeances";
import { coursDeLEleve, devoirsDeLEleve, seancesPubliees } from "@/lib/espace-eleve";

/**
 * Accueil de l'élève — cahier V2, §7.1.
 *
 * L'écran répond à « qu'est-ce que je dois faire, et où est le cours
 * d'aujourd'hui ». Rien d'autre : pas de notes, pas de compteur de points, pas
 * de statistique d'assiduité. Un élève ouvre cette page entre deux cours, sur
 * un téléphone, souvent en retard.
 */
export const dynamic = "force-dynamic";

export default async function PageEleve() {
  const personne = await sessionCourante();
  if (personne === null) redirect("/connexion");

  const jeton = await jetonAccesDe(personne);
  if (jeton === null) redirect("/connexion");

  const [cours, seances, devoirs] = await Promise.all([
    coursDeLEleve(jeton),
    seancesPubliees(jeton, { limite: 40 }),
    devoirsDeLEleve(jeton),
  ]);

  const libelles = new Map(cours.map((c) => [c.id, c.libelle] as const));
  const duJour = seancesDuJour(seances);
  const recentes = seances.filter((seance) => !duJour.includes(seance)).slice(0, 6);
  const { aVenir } = trierDevoirs(devoirs);

  if (cours.length === 0) {
    return (
      <>
        <TitreEspace titre={`Bonjour ${personne.prenom}`} sousTitre={personne.organisation} />
        <div className="mt-8">
          <Vide
            titre="Votre compte n'est rattaché à aucune classe."
            texte="Vos cours apparaîtront ici dès que votre établissement aura enregistré votre inscription. Si vous pensez qu'il y a une erreur, adressez-vous à la vie scolaire."
          />
        </div>
      </>
    );
  }

  return (
    <>
      <TitreEspace titre={`Bonjour ${personne.prenom}`} sousTitre={personne.organisation} />

      <section className="mt-9">
        <h2 className="text-[length:var(--text-h2-app)] leading-[var(--text-h2-app--line-height)]">
          Aujourd&apos;hui
        </h2>

        {duJour.length === 0 ? (
          <p className="m-0 mt-3 max-w-[var(--spacing-lecture)] text-[color:var(--color-encre-faible)]">
            Aucune séance n&apos;est datée d&apos;aujourd&apos;hui. Vos cours
            récents restent accessibles dans « Mes cours ».
          </p>
        ) : (
          <ul className="m-0 mt-4 grid list-none gap-3 p-0 sm:grid-cols-2">
            {duJour.map((seance) => (
              <li key={seance.id}>
                <Link href={`/eleve/cours/${seance.id}`} className="carte block p-5 no-underline">
                  <span className="block text-[length:var(--text-aide)] text-[color:var(--color-encre-faible)]">
                    {libelles.get(seance.teaching_space_id) ?? "Cours"}
                  </span>
                  <span className="mt-1 block font-semibold text-[color:var(--color-encre)]">
                    {seance.title}
                  </span>
                  {seance.objective ? (
                    <span className="mt-1.5 block text-[length:var(--text-tableau)] text-[color:var(--color-encre-faible)]">
                      {seance.objective}
                    </span>
                  ) : null}
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      <div className="mt-11 grid gap-11 lg:grid-cols-2 lg:items-start">
        <section>
          <div className="flex items-baseline justify-between gap-3">
            <h2 className="text-[length:var(--text-h2-app)] leading-[var(--text-h2-app--line-height)]">
              À faire
            </h2>
            {aVenir.length > 0 ? (
              <Link
                href="/eleve/devoirs"
                className="text-[length:var(--text-aide)] text-[color:var(--color-accent)]"
              >
                Tout voir
              </Link>
            ) : null}
          </div>

          {aVenir.length === 0 ? (
            <p className="m-0 mt-3 text-[color:var(--color-encre-faible)]">
              Rien à rendre pour le moment.
            </p>
          ) : (
            <ul className="m-0 mt-3 list-none p-0">
              {aVenir.slice(0, 6).map((devoir) => (
                <li key={devoir.id}>
                  <Link
                    href={
                      devoir.lesson_id === null
                        ? "/eleve/devoirs"
                        : `/eleve/cours/${devoir.lesson_id}`
                    }
                    className="flex min-h-[var(--spacing-cible)] flex-wrap items-center justify-between gap-3 border-b border-[color:var(--color-bordure)] px-1 py-3 no-underline transition-colors hover:bg-[color:var(--color-survol)]"
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-[color:var(--color-encre)]">
                        {devoir.title}
                      </span>
                      <span className="mt-0.5 block text-[length:var(--text-aide)] text-[color:var(--color-encre-faible)]">
                        {libelles.get(devoir.teaching_space_id) ?? "Cours"}
                      </span>
                    </span>
                    <span className="text-[length:var(--text-tableau)] text-[color:var(--color-encre-faible)]">
                      {echeanceLisible(devoir.due_at)}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>

        <section>
          <h2 className="text-[length:var(--text-h2-app)] leading-[var(--text-h2-app--line-height)]">
            Derniers cours publiés
          </h2>

          {recentes.length === 0 ? (
            <p className="m-0 mt-3 text-[color:var(--color-encre-faible)]">
              Aucune séance n&apos;a encore été publiée dans vos cours.
            </p>
          ) : (
            <ul className="m-0 mt-3 list-none p-0">
              {recentes.map((seance) => (
                <li key={seance.id}>
                  <Link
                    href={`/eleve/cours/${seance.id}`}
                    className="flex min-h-[var(--spacing-cible)] flex-wrap items-center justify-between gap-3 border-b border-[color:var(--color-bordure)] px-1 py-3 no-underline transition-colors hover:bg-[color:var(--color-survol)]"
                  >
                    <span className="min-w-0">
                      <span className="block truncate font-medium text-[color:var(--color-encre)]">
                        {seance.title}
                      </span>
                      <span className="mt-0.5 block text-[length:var(--text-aide)] text-[color:var(--color-encre-faible)]">
                        {libelles.get(seance.teaching_space_id) ?? "Cours"}
                      </span>
                    </span>
                    <span className="text-[length:var(--text-aide)] text-[color:var(--color-encre-tres-faible)]">
                      {seance.scheduled_for === null
                        ? ""
                        : new Date(seance.scheduled_for).toLocaleDateString("fr-FR", {
                            day: "numeric",
                            month: "short",
                          })}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>
    </>
  );
}
