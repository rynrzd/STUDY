import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { TitreEspace, Vide } from "@/components/app/Cadre";
import { jetonAccesDe, sessionCourante } from "@/lib/session-serveur";
import { echeanceLisible, trierDevoirs } from "@/lib/echeances";
import { coursDeLEleve, devoirsDeLEleve } from "@/lib/espace-eleve";

export const metadata: Metadata = { title: "À faire" };

/**
 * À faire — cahier V2, §11.
 *
 * Une seule liste, triée par échéance, sans case à cocher ni pourcentage
 * d'avancement : AvecStudy ne prétend pas savoir ce que l'élève a réellement
 * fait. Afficher « 60 % terminé » serait une statistique inventée, exactement
 * ce que le cahier interdit.
 */
export const dynamic = "force-dynamic";

export default async function PageDevoirsEleve() {
  const personne = await sessionCourante();
  if (personne === null) redirect("/connexion");

  const jeton = await jetonAccesDe(personne);
  if (jeton === null) redirect("/connexion");

  const [cours, devoirs] = await Promise.all([coursDeLEleve(jeton), devoirsDeLEleve(jeton)]);
  const libelles = new Map(cours.map((c) => [c.id, c.libelle] as const));
  const { aVenir, passes } = trierDevoirs(devoirs);

  if (devoirs.length === 0) {
    return (
      <>
        <TitreEspace titre="À faire" />
        <div className="mt-8">
          <Vide
            titre="Rien à rendre pour le moment."
            texte="Les devoirs donnés par vos professeurs apparaissent ici, du plus proche au plus lointain, avec le cours auquel ils se rattachent."
            action={
              <Link href="/eleve/cours" className="bouton bouton-secondaire">
                Voir mes cours
              </Link>
            }
          />
        </div>
      </>
    );
  }

  return (
    <>
      <TitreEspace
        titre="À faire"
        sousTitre={`${aVenir.length} devoir${aVenir.length > 1 ? "s" : ""} à venir`}
      />

      <Liste titre="À venir" devoirs={aVenir} libelles={libelles} vide="Rien à rendre pour le moment." />

      {passes.length > 0 ? (
        <Liste titre="Échéance passée" devoirs={passes} libelles={libelles} vide="" />
      ) : null}
    </>
  );
}

/* -------------------------------------------------------------------------- */

function Liste({
  titre,
  devoirs,
  libelles,
  vide,
}: {
  titre: string;
  devoirs: readonly {
    id: string;
    title: string;
    due_at: string | null;
    lesson_id: string | null;
    teaching_space_id: string;
  }[];
  libelles: Map<string, string>;
  vide: string;
}) {
  return (
    <section className="mt-9">
      <h2 className="text-[length:var(--text-h2-app)] leading-[var(--text-h2-app--line-height)]">
        {titre}
      </h2>

      {devoirs.length === 0 ? (
        <p className="m-0 mt-3 text-[color:var(--color-encre-faible)]">{vide}</p>
      ) : (
        <ul className="m-0 mt-3 list-none p-0">
          {devoirs.map((devoir) => {
            const contenu = (
              <>
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
              </>
            );

            const classes =
              "flex min-h-[var(--spacing-cible)] flex-wrap items-center justify-between gap-3 border-b border-[color:var(--color-bordure)] px-1 py-3";

            return (
              <li key={devoir.id}>
                {devoir.lesson_id === null ? (
                  <div className={classes}>{contenu}</div>
                ) : (
                  <Link
                    href={`/eleve/cours/${devoir.lesson_id}`}
                    className={`${classes} no-underline transition-colors hover:bg-[color:var(--color-survol)]`}
                  >
                    {contenu}
                  </Link>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
