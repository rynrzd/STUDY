import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { TitreEspace } from "@/components/app/Cadre";
import { jetonAccesDe, sessionCourante } from "@/lib/session-serveur";
import { coursDuProfesseur } from "@/lib/studio";
import {
  classesDuProfesseur,
  effectifsParClasse,
  elevesDeLaClasse,
} from "@/lib/espace-professeur";
import { FormulaireCreationClasse } from "./FormulaireCreation";

export const metadata: Metadata = { title: "Mes classes" };

/**
 * Mes classes — cahier V2, §8.2.
 *
 * La classe sélectionnée passe par l'adresse plutôt que par un état de
 * composant : le professeur peut ainsi garder l'onglet « Seconde 4 » ouvert
 * pendant son cours, et la page fonctionne sans JavaScript.
 *
 * L'identifiant de classe vient donc du navigateur. Ce n'est pas un risque :
 * `elevesDeLaClasse` lit avec le jeton du professeur, et une classe où il
 * n'enseigne pas renvoie une liste vide — pas les élèves de quelqu'un d'autre.
 */
export const dynamic = "force-dynamic";

export default async function PageClasses({
  searchParams,
}: {
  searchParams: Promise<{ classe?: string }>;
}) {
  const personne = await sessionCourante();
  if (personne === null) redirect("/connexion");

  const jeton = await jetonAccesDe(personne);
  if (jeton === null) redirect("/connexion");

  const cours = await coursDuProfesseur(jeton);
  const [classes, effectifs] = await Promise.all([
    classesDuProfesseur(jeton, cours),
    effectifsParClasse(jeton),
  ]);

  if (classes.length === 0) {
    return (
      <>
        <TitreEspace titre="Mes classes" />
        <div className="mt-8"><FormulaireCreationClasse /></div>
      </>
    );
  }

  const parametres = await searchParams;
  const choisie = classes.find((classe) => classe.id === parametres.classe) ?? classes[0]!;
  const eleves = await elevesDeLaClasse(jeton, choisie.id);

  return (
    <>
      <TitreEspace
        titre="Mes classes"
        sousTitre={`${classes.length} classe${classes.length > 1 ? "s" : ""}`}
      />

      <div className="mt-8 grid gap-8 lg:grid-cols-[260px_minmax(0,1fr)] lg:items-start">
        <nav aria-label="Mes classes">
          <ul className="m-0 flex list-none flex-wrap gap-2 p-0 lg:flex-col lg:gap-1">
            {classes.map((classe) => {
              const active = classe.id === choisie.id;
              return (
                <li key={classe.id} className="lg:w-full">
                  <Link
                    href={`/professeur/classes?classe=${classe.id}`}
                    aria-current={active ? "page" : undefined}
                    className={`flex min-h-[var(--spacing-cible)] items-center justify-between gap-3 rounded-[var(--radius-champ)] px-3.5 no-underline lg:w-full ${
                      active
                        ? "bg-[color:var(--color-rose-clair)] font-semibold text-[color:var(--color-accent)]"
                        : "text-[color:var(--color-encre-faible)] hover:bg-[color:var(--color-survol)]"
                    }`}
                  >
                    <span className="truncate">{classe.label}</span>
                    <span className="text-[length:var(--text-aide)]">
                      {effectifs.get(classe.id) ?? 0}
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        <section>
          <div className="flex flex-wrap items-baseline justify-between gap-3 border-b border-[color:var(--color-bordure)] pb-2">
            <h2 className="text-[length:var(--text-h2-app)] leading-[var(--text-h2-app--line-height)]">
              {choisie.label}
            </h2>
            <p className="m-0 text-[length:var(--text-aide)] text-[color:var(--color-encre-faible)]">
              {choisie.matieres.join(" · ")}
            </p>
          </div>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link className="bouton bouton-primaire" href={`/professeur/classes/importer?classe=${choisie.id}`}>Importer des élèves</Link>
            <Link className="bouton bouton-secondaire" href={`/app/classes/${choisie.id}/membres`}>Invitations et demandes</Link>
          </div>

          {eleves.length === 0 ? (
            <p className="m-0 mt-5 max-w-[var(--spacing-lecture)] text-[color:var(--color-encre-faible)]">
              Aucun élève n&apos;est inscrit. Importe une liste PDF ou un tableur, vérifie les noms, puis distribue les invitations individuelles.
            </p>
          ) : (
            <>
              <p className="m-0 mt-5 text-[length:var(--text-tableau)] text-[color:var(--color-encre-faible)]">
                {eleves.length} élève{eleves.length > 1 ? "s" : ""}
              </p>
              <ul className="m-0 mt-3 grid list-none gap-x-8 p-0 sm:grid-cols-2 xl:grid-cols-3">
                {eleves.map((eleve) => (
                  <li
                    key={eleve.id}
                    className="flex min-h-[var(--spacing-cible)] items-center border-b border-[color:var(--color-bordure)] px-1"
                  >
                    <span className="truncate">
                      <span className="font-medium">{eleve.nom.toUpperCase()}</span>{" "}
                      {eleve.prenom}
                    </span>
                  </li>
                ))}
              </ul>
            </>
          )}

          <p className="m-0 mt-8 max-w-[var(--spacing-lecture)] text-[length:var(--text-aide)] leading-[var(--text-aide--line-height)] text-[color:var(--color-encre-tres-faible)]">
            Réimporter la même liste rapproche les élèves existants et ne crée pas de doublon.
          </p>
        </section>
      </div>
    </>
  );
}
