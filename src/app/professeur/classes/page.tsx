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
        <TitreEspace titre="On crée ta première classe ?" sousTitre="Deux informations suffisent pour commencer. Les élèves pourront être ajoutés plus tard." />
        <div className="mt-7 grid items-start gap-6 lg:grid-cols-[minmax(0,1fr)_290px]">
          <FormulaireCreationClasse />
          <aside className="rounded-2xl border border-[color:var(--color-bordure)] bg-[color:var(--color-surface)] p-5">
            <h2 className="mt-0 text-base font-bold">Et après ?</h2>
            <ol className="mb-0 grid gap-3 pl-5 text-sm leading-6 text-[color:var(--color-encre-faible)]">
              <li>Tu retrouves ta classe dans « Mes classes ».</li>
              <li>Tu peux préparer un cours, même sans élèves.</li>
              <li>Quand tu es prêt, tu invites tes élèves et tu publies.</li>
            </ol>
          </aside>
        </div>
        <p className="mt-6 text-sm"><Link href="/professeur/demarrage">← Revoir le guide de démarrage</Link></p>
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
          {eleves.length === 0 ? (
            <div className="mt-5 rounded-2xl border border-[#e7cad6] bg-[#fff3f7] p-5">
              <p className="m-0 text-xs font-bold uppercase tracking-[0.12em] text-[#874b62]">Ta prochaine étape</p>
              <h3 className="mb-1 mt-2 text-lg font-bold text-[#44333d]">Prépare ton premier cours pour {choisie.label}.</h3>
              <p className="mt-0 text-sm leading-6 text-[#65545e]">Tu peux rédiger une séance et la garder en brouillon. Pas besoin d&apos;avoir déjà invité les élèves.</p>
              <Link className="bouton bouton-primaire" href="/studio">Préparer un cours</Link>
            </div>
          ) : null}
          <div className="mt-4 flex flex-wrap gap-3">
            <Link className="bouton bouton-secondaire" href={`/professeur/classes/importer?classe=${choisie.id}`}>Importer des élèves</Link>
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
