import Link from "next/link";
import { redirect } from "next/navigation";
import { TitreEspace, Vide } from "@/components/app/Cadre";
import { jetonAccesDe, sessionCourante } from "@/lib/session-serveur";
import { echeanceLisible, seancesDuJour, trierDevoirs } from "@/lib/echeances";
import { coursDeLEleve, devoirsDeLEleve, seancesPubliees } from "@/lib/espace-eleve";
import { CaseFaite } from "@/components/app/CaseFaite";
import { classeActive, nouveautes, travauxFaits } from "@/lib/parcours-eleve";

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

  const [cours, seances, devoirs, classe, faits, depuis] = await Promise.all([
    coursDeLEleve(jeton),
    seancesPubliees(jeton, { limite: 40 }),
    devoirsDeLEleve(jeton),
    classeActive(jeton),
    travauxFaits(jeton),
    nouveautes(jeton),
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
      <TitreEspace
        titre={`Bonjour ${personne.prenom}`}
        sousTitre={classe === null ? personne.organisation : `${classe} · ${personne.organisation}`}
      />

      <section className="mt-9">
        <h2 className="text-[length:var(--text-h2-app)] leading-[var(--text-h2-app--line-height)]">
          Aujourd&apos;hui
        </h2>

        {duJour.length === 0 ? (
          <p className="m-0 mt-3 max-w-[var(--spacing-lecture)] text-[color:var(--color-encre-faible)]">
            Rien de nouveau aujourd&apos;hui. Vos cours récents restent
            accessibles dans « Mes cours ».
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

      {depuis.length > 0 ? (
        <section aria-labelledby="titre-depuis" className="mt-11">
          <h2
            id="titre-depuis"
            className="text-[length:var(--text-h2-app)] leading-[var(--text-h2-app--line-height)]"
          >
            Depuis ta dernière visite
          </h2>
          <ul className="m-0 mt-3 list-none p-0">
            {depuis.map((nouveaute) => (
              <li key={`${nouveaute.genre}-${nouveaute.seance}-${nouveaute.survenuLe}`}>
                <Link
                  href={
                    nouveaute.seance === null
                      ? "/eleve/cours"
                      : `/eleve/cours/${nouveaute.seance}`
                  }
                  className="flex min-h-[var(--spacing-cible)] flex-wrap items-center justify-between gap-3 border-b border-[color:var(--color-bordure)] px-1 py-3 no-underline transition-colors hover:bg-[color:var(--color-survol)]"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-[color:var(--color-encre)]">
                      {nouveaute.titre}
                    </span>
                    <span className="mt-0.5 block text-[length:var(--text-aide)] text-[color:var(--color-encre-faible)]">
                      {GENRE[nouveaute.genre]} · {nouveaute.contexte}
                    </span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

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
                <li
                  key={devoir.id}
                  className="flex min-h-[var(--spacing-cible)] items-center gap-3 border-b border-[color:var(--color-bordure)] py-3"
                >
                  {/* Le lien et la case sont voisins, pas imbriques : une case a
                      cocher dans un lien se declenche au mauvais endroit, et
                      ouvre le devoir quand on voulait juste le barrer. */}
                  <Link
                    href={
                      devoir.lesson_id === null
                        ? "/eleve/devoirs"
                        : `/eleve/cours/${devoir.lesson_id}`
                    }
                    className="min-w-0 flex-1 px-1 no-underline"
                  >
                    <span
                      className={`block truncate font-medium text-[color:var(--color-encre)] ${
                        faits.has(devoir.id) ? "line-through opacity-60" : ""
                      }`}
                    >
                      {devoir.title}
                    </span>
                    <span className="mt-0.5 block text-[length:var(--text-aide)] text-[color:var(--color-encre-faible)]">
                      {libelles.get(devoir.teaching_space_id) ?? "Cours"} ·{" "}
                      {echeanceLisible(devoir.due_at)}
                    </span>
                  </Link>
                  <CaseFaite
                    devoir={devoir.id}
                    fait={faits.has(devoir.id)}
                    libelle={devoir.title}
                  />
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

/**
 * Ce que chaque nouveauté est, dit en clair.
 *
 * Le §3.4 limite le résumé à ce qui est réellement arrivé : une séance
 * publiée, un corrigé ouvert, un devoir donné, une réponse à sa question.
 * Aucune autre catégorie n existe, et surtout pas « activité » — un mot qui
 * ne dit rien et qui laisserait passer n importe quoi.
 */
const GENRE: Record<string, string> = {
  seance: "Nouveau cours",
  correction: "Corrigé disponible",
  devoir: "Nouveau devoir",
  reponse: "Réponse à votre question",
};
