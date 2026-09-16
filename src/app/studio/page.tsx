import Link from "next/link";
import { redirect } from "next/navigation";
import { NouveauChapitre, NouvelleSeance } from "@/components/studio/Creation";
import { TitreEspace, Vide } from "@/components/app/Cadre";
import { jetonAccesDe, sessionCourante } from "@/lib/session-serveur";
import { chapitresDuCours, coursDuProfesseur, seancesDuCours } from "@/lib/studio";

/**
 * Studio — liste des cours, chapitres et séances (cahier V2, §9.1 et §9.2).
 *
 * L'écran d'accueil du Studio ne demande pas de choisir dans trois menus avant
 * de voir quoi que ce soit : le premier cours est sélectionné d'office, et
 * l'on change de cours par un lien. Un professeur qui prépare son cours de
 * 10 h ne devrait pas avoir à naviguer pour l'atteindre.
 */
export const dynamic = "force-dynamic";

export default async function PageStudio({
  searchParams,
}: {
  searchParams: Promise<{ cours?: string }>;
}) {
  const personne = await sessionCourante();
  if (personne === null) redirect("/connexion");

  const jeton = await jetonAccesDe(personne);
  const cours = jeton === null ? [] : await coursDuProfesseur(jeton);

  if (cours.length === 0) {
    return (
      <>
        <TitreEspace titre="Studio" />
        <div className="mt-8">
          <Vide
            titre="Aucun cours ne vous est affecté."
            texte="Le Studio s'ouvre sur les classes et matières que l'administration de votre établissement vous a attribuées. Si cette liste est vide, c'est que l'affectation n'a pas encore été faite."
            action={
              <Link href="/professeur" className="bouton bouton-secondaire">
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

  const [chapitres, seances] = await Promise.all([
    chapitresDuCours(jeton!, choisi.id),
    seancesDuCours(jeton!, choisi.id),
  ]);

  const sansChapitre = seances.filter((seance) => seance.chapter_id === null);

  return (
    <>
      <TitreEspace
        titre="Studio"
        sousTitre={choisi.libelle}
        action={<NouvelleSeance cours={choisi.id} chapitres={chapitres} />}
      />

      {cours.length > 1 ? (
        <nav aria-label="Mes cours" className="mt-6">
          <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
            {cours.map((autre) => (
              <li key={autre.id}>
                <Link
                  href={`/studio?cours=${autre.id}`}
                  aria-current={autre.id === choisi.id ? "page" : undefined}
                  className={`inline-flex min-h-9 items-center rounded-full border px-3.5 text-[length:var(--text-tableau)] no-underline ${
                    autre.id === choisi.id
                      ? "border-[color:var(--color-accent)] bg-[color:var(--color-rose-clair)] font-semibold text-[color:var(--color-accent)]"
                      : "border-[color:var(--color-bordure)] bg-[color:var(--color-surface)] text-[color:var(--color-encre-faible)] hover:border-[color:var(--color-bordure-forte)]"
                  }`}
                >
                  {autre.libelle}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      ) : null}

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_300px] lg:items-start">
        <div className="space-y-8">
          {chapitres.length === 0 && seances.length === 0 ? (
            <Vide
              titre="Ce cours est encore vide."
              texte="Créez un premier chapitre — « Chapitre 1 — Suites », par exemple — puis ajoutez-y vos séances. Une séance reste un brouillon tant que vous ne l'avez pas publiée."
            />
          ) : null}

          {chapitres.map((chapitre) => (
            <ListeChapitre
              key={chapitre.id}
              titre={chapitre.label}
              seances={seances.filter((seance) => seance.chapter_id === chapitre.id)}
              cours={choisi.id}
              chapitre={chapitre.id}
              chapitres={chapitres}
            />
          ))}

          {sansChapitre.length > 0 ? (
            <ListeChapitre
              titre="Sans chapitre"
              seances={sansChapitre}
              cours={choisi.id}
              chapitre={null}
              chapitres={chapitres}
            />
          ) : null}
        </div>

        <aside className="lg:sticky lg:top-24">
          <NouveauChapitre cours={choisi.id} />
        </aside>
      </div>
    </>
  );
}

/* -------------------------------------------------------------------------- */

function ListeChapitre({
  titre,
  seances,
  cours,
  chapitre,
  chapitres,
}: {
  titre: string;
  seances: { id: string; title: string; state: string; scheduled_for: string | null }[];
  cours: string;
  chapitre: string | null;
  chapitres: { id: string; label: string }[];
}) {
  return (
    <section>
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[color:var(--color-bordure)] pb-2">
        <h2 className="text-[length:var(--text-h2-app)] leading-[var(--text-h2-app--line-height)]">
          {titre}
        </h2>
        <span className="text-[length:var(--text-aide)] text-[color:var(--color-encre-tres-faible)]">
          {seances.length} séance{seances.length > 1 ? "s" : ""}
        </span>
      </div>

      {seances.length === 0 ? (
        <p className="m-0 mt-4 text-[length:var(--text-tableau)] text-[color:var(--color-encre-faible)]">
          Aucune séance dans ce chapitre.
        </p>
      ) : (
        <ul className="m-0 mt-3 list-none p-0">
          {seances.map((seance) => (
            <li key={seance.id}>
              <Link
                href={`/studio/${seance.id}`}
                className="flex min-h-[var(--spacing-cible)] flex-wrap items-center justify-between gap-3 border-b border-[color:var(--color-bordure)] px-1 py-3 no-underline transition-colors hover:bg-[color:var(--color-survol)]"
              >
                <span className="min-w-0">
                  <span className="block truncate font-medium text-[color:var(--color-encre)]">
                    {seance.title}
                  </span>
                  <span className="mt-0.5 block text-[length:var(--text-aide)] text-[color:var(--color-encre-faible)]">
                    {seance.scheduled_for === null
                      ? "Sans date"
                      : new Date(seance.scheduled_for).toLocaleDateString("fr-FR", {
                          weekday: "long",
                          day: "numeric",
                          month: "long",
                        })}
                  </span>
                </span>
                <span
                  className={`pastille ${
                    seance.state === "publiee" ? "pastille-publie" : "pastille-brouillon"
                  }`}
                >
                  {seance.state === "publiee" ? "Publiée" : "Brouillon"}
                </span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-4">
        <NouvelleSeance cours={cours} chapitres={chapitres} chapitreParDefaut={chapitre} compact />
      </div>
    </section>
  );
}
