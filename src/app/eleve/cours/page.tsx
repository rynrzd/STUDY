import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { TitreEspace, Vide } from "@/components/app/Cadre";
import { jetonAccesDe, sessionCourante } from "@/lib/session-serveur";
import { coursDeLEleve, seancesPubliees } from "@/lib/espace-eleve";

export const metadata: Metadata = { title: "Mes cours" };

/**
 * Mes cours — cahier V2, §7.2.
 *
 * Un cours choisi, ses séances publiées du plus récent au plus ancien. Le choix
 * passe par l'adresse : l'élève peut mettre « Maths » en favori, et la page
 * fonctionne sans JavaScript.
 */
export const dynamic = "force-dynamic";

export default async function PageCoursEleve({
  searchParams,
}: {
  searchParams: Promise<{ cours?: string }>;
}) {
  const personne = await sessionCourante();
  if (personne === null) redirect("/connexion");

  const jeton = await jetonAccesDe(personne);
  if (jeton === null) redirect("/connexion");

  const cours = await coursDeLEleve(jeton);

  if (cours.length === 0) {
    return (
      <>
        <TitreEspace titre="Mes cours" />
        <div className="mt-8">
          <Vide
            titre="Aucun cours pour le moment."
            texte="Vos cours apparaîtront ici dès que votre établissement aura enregistré votre inscription dans une classe."
            action={
              <Link href="/eleve" className="bouton bouton-secondaire">
                Retour à l&apos;accueil
              </Link>
            }
          />
        </div>
      </>
    );
  }

  const parametres = await searchParams;
  const choisi = cours.find((c) => c.id === parametres.cours) ?? cours[0]!;
  const seances = await seancesPubliees(jeton, { cours: choisi.id });

  return (
    <>
      <TitreEspace titre="Mes cours" sousTitre={choisi.libelle} />

      <nav aria-label="Mes cours" className="mt-6">
        <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
          {cours.map((autre) => {
            const active = autre.id === choisi.id;
            return (
              <li key={autre.id}>
                <Link
                  href={`/eleve/cours?cours=${autre.id}`}
                  aria-current={active ? "page" : undefined}
                  className={`inline-flex min-h-9 items-center rounded-full border px-3.5 text-[length:var(--text-tableau)] no-underline ${
                    active
                      ? "border-[color:var(--color-accent)] bg-[color:var(--color-rose-clair)] font-semibold text-[color:var(--color-accent)]"
                      : "border-[color:var(--color-bordure)] bg-[color:var(--color-surface)] text-[color:var(--color-encre-faible)] hover:border-[color:var(--color-bordure-forte)]"
                  }`}
                >
                  {autre.libelle}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      <section className="mt-8">
        {seances.length === 0 ? (
          <Vide
            titre="Aucune séance publiée dans ce cours."
            texte="Votre professeur prépare ses séances avant de les publier. Elles apparaîtront ici dès qu'il les rendra visibles."
          />
        ) : (
          <ul className="m-0 list-none p-0">
            {seances.map((seance) => (
              <li key={seance.id}>
                <Link
                  href={`/eleve/cours/${seance.id}`}
                  className="flex min-h-[var(--spacing-cible)] flex-wrap items-center justify-between gap-3 border-b border-[color:var(--color-bordure)] px-1 py-3.5 no-underline transition-colors hover:bg-[color:var(--color-survol)]"
                >
                  <span className="min-w-0">
                    <span className="block truncate font-medium text-[color:var(--color-encre)]">
                      {seance.title}
                    </span>
                    {seance.objective ? (
                      <span className="mt-0.5 block truncate text-[length:var(--text-aide)] text-[color:var(--color-encre-faible)]">
                        {seance.objective}
                      </span>
                    ) : null}
                  </span>
                  <span className="text-[length:var(--text-aide)] text-[color:var(--color-encre-tres-faible)]">
                    {seance.scheduled_for === null
                      ? "Sans date"
                      : new Date(seance.scheduled_for).toLocaleDateString("fr-FR", {
                          day: "numeric",
                          month: "long",
                        })}
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
