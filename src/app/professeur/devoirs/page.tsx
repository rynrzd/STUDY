import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { TitreEspace, Vide } from "@/components/app/Cadre";
import { jetonAccesDe, sessionCourante } from "@/lib/session-serveur";
import { coursDuProfesseur } from "@/lib/studio";
import { devoirsDuProfesseur } from "@/lib/espace-professeur";
import { echeanceLisible, trierDevoirs } from "@/lib/echeances";

export const metadata: Metadata = { title: "Devoirs" };

/**
 * Devoirs donnés — cahier V2, §11.
 *
 * Un devoir n'existe pas séparément d'une séance : il est créé depuis le Studio,
 * dans un bloc « devoir ». Cette page est donc une vue de lecture — elle
 * rassemble ce qui est éparpillé dans les séances, et renvoie à la séance pour
 * modifier. C'est volontaire : deux endroits pour écrire la même chose, ce sont
 * deux versions qui divergent.
 */
export const dynamic = "force-dynamic";

export default async function PageDevoirsProfesseur() {
  const personne = await sessionCourante();
  if (personne === null) redirect("/connexion");

  const jeton = await jetonAccesDe(personne);
  if (jeton === null) redirect("/connexion");

  const [cours, devoirs] = await Promise.all([
    coursDuProfesseur(jeton),
    devoirsDuProfesseur(jeton),
  ]);

  const libelles = new Map(cours.map((c) => [c.id, c.libelle] as const));
  const donnes = devoirs.filter((devoir) => devoir.state === "publiee");
  const { aVenir, passes } = trierDevoirs(donnes);

  if (donnes.length === 0) {
    return (
      <>
        <TitreEspace titre="Devoirs" />
        <div className="mt-8">
          <Vide
            titre="Vous n'avez donné aucun devoir."
            texte="Un devoir se crée dans le Studio : ouvrez une séance, ajoutez un bloc « devoir », donnez-lui un titre et une date limite. Il apparaîtra ici et dans la liste « À faire » de vos élèves une fois la séance publiée."
            action={
              <Link href="/studio" className="bouton bouton-rose">
                Ouvrir le Studio
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
        titre="Devoirs"
        sousTitre={`${donnes.length} devoir${donnes.length > 1 ? "s" : ""} donné${
          donnes.length > 1 ? "s" : ""
        }`}
      />

      <Groupe
        titre="À venir"
        vide="Aucun devoir à venir."
        devoirs={aVenir}
        libelles={libelles}
      />

      {passes.length > 0 ? (
        <Groupe titre="Échéance passée" vide="" devoirs={passes} libelles={libelles} />
      ) : null}
    </>
  );
}

/* -------------------------------------------------------------------------- */

function Groupe({
  titre,
  vide,
  devoirs,
  libelles,
}: {
  titre: string;
  vide: string;
  devoirs: readonly {
    id: string;
    title: string;
    due_at: string | null;
    lesson_id: string | null;
    teaching_space_id: string;
  }[];
  libelles: Map<string, string>;
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
                    href={`/studio/${devoir.lesson_id}`}
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
