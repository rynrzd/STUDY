import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { TitreEspace, Vide } from "@/components/app/Cadre";
import { Groupes } from "@/components/entraide/Groupes";
import { groupesDuCours } from "@/lib/entraide";
import { coursDeLEleve } from "@/lib/espace-eleve";
import { jetonAccesDe, sessionCourante } from "@/lib/session-serveur";

export const metadata: Metadata = { title: "Entraide" };

/**
 * Groupes d'entraide — cahier V2, §13.
 *
 * Un groupe appartient à un cours : on travaille à plusieurs sur le cours de
 * maths de sa classe. Il n'y a ni messagerie libre entre comptes, ni annuaire
 * d'élèves, ni recherche de camarades — ce serait un réseau social dans un
 * outil scolaire, et le cahier ne le demande pas.
 *
 * Le cours choisi passe par l'adresse : sans JavaScript, la page fonctionne.
 */
export const dynamic = "force-dynamic";

export default async function PageEntraide({
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
        <TitreEspace titre="Entraide" />
        <div className="mt-8">
          <Vide
            titre="Aucun cours pour le moment."
            texte="Les groupes d'entraide se créent à l'intérieur d'un cours. Ils apparaîtront ici dès que votre inscription sera enregistrée."
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
  const groupes = await groupesDuCours(jeton, choisi.id, personne.profileId);

  return (
    <>
      <TitreEspace titre="Entraide" sousTitre={choisi.libelle} />

      {cours.length > 1 ? (
        <nav aria-label="Mes cours" className="mt-6">
          <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
            {cours.map((autre) => {
              const active = autre.id === choisi.id;
              return (
                <li key={autre.id}>
                  <Link
                    href={`/eleve/entraide?cours=${autre.id}`}
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
      ) : null}

      {groupes.length === 0 ? (
        <div className="mt-8">
          <Vide
            titre="Aucun groupe dans ce cours."
            texte="Un groupe réunit de 2 à 6 élèves de ce cours pour réviser ou avancer ensemble. Celui qui le crée en fait partie ; les autres le rejoignent tant qu'il reste de la place."
            action={
              <div className="w-full max-w-[42rem]">
                <Groupes cours={choisi.id} groupes={[]} />
              </div>
            }
          />
        </div>
      ) : (
        <Groupes cours={choisi.id} groupes={groupes} />
      )}

      <p className="m-0 mt-10 max-w-[var(--spacing-lecture)] text-[length:var(--text-aide)] leading-[var(--text-aide--line-height)] text-[color:var(--color-encre-tres-faible)]">
        Votre professeur voit les groupes de son cours et leur composition. Il
        n&apos;y a pas de messagerie privée entre comptes dans AvecStudy :
        l&apos;entraide se prépare ici, elle se fait en classe ou ailleurs.
      </p>
    </>
  );
}
