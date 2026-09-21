import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { TitreEspace, Vide } from "@/components/app/Cadre";
import { FormulaireDevoir } from "@/components/professeur/FormulaireDevoir";
import { devoirsDuProfesseur, type Devoir } from "@/lib/devoirs";
import { instantLisible } from "@/lib/horodatage";
import { jetonAccesDe, sessionCourante } from "@/lib/session-serveur";
import { coursDuProfesseur, seancesDuCours } from "@/lib/studio";

export const metadata: Metadata = { title: "Devoirs" };

/**
 * Devoirs donnés — cahier V5, §2.
 *
 * Écran de travail, pas de consultation : le professeur y crée un devoir, le
 * publie, et suit les remises. C'est un changement de nature par rapport à la
 * version précédente, qui ne faisait que rassembler les devoirs créés depuis
 * les séances.
 *
 * Les brouillons sont en haut. C'est ce qu'on a commencé et pas fini — donc ce
 * qu'on risque d'oublier.
 */
export const dynamic = "force-dynamic";

const ETATS: Record<string, string> = {
  brouillon: "Brouillon",
  publie: "Publié",
  publie_en_retard: "Échéance passée",
  ferme: "Fermé",
  archive: "Archivé",
};

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

  // Les séances publiées de chaque cours, pour pouvoir y rattacher un devoir.
  const seances = (
    await Promise.all(
      cours.map(async (unCours) => {
        const liste = await seancesDuCours(jeton, unCours.id);
        return liste.map((seance) => ({
          id: seance.id,
          titre: seance.title,
          cours: unCours.id,
        }));
      }),
    )
  ).flat();

  const rang: Record<string, number> = {
    brouillon: 0,
    publie: 1,
    publie_en_retard: 2,
    ferme: 3,
    archive: 4,
  };

  const tries = [...devoirs].sort(
    (a, b) =>
      (rang[a.etat] ?? 9) - (rang[b.etat] ?? 9) ||
      (a.echeance ?? "").localeCompare(b.echeance ?? ""),
  );

  return (
    <>
      <TitreEspace
        titre="Devoirs"
        sousTitre={
          devoirs.length === 0
            ? undefined
            : `${devoirs.length} devoir${devoirs.length > 1 ? "s" : ""}`
        }
      />

      {cours.length === 0 ? (
        <div className="mt-8">
          <Vide
            titre="Aucune classe ne vous est affectée."
            texte="Un devoir se donne à une classe. Demandez à l'administration de votre établissement de vous rattacher à vos cours."
          />
        </div>
      ) : (
        <>
          <section className="mt-8 print:hidden">
            <h2 className="m-0 mb-4 text-[length:var(--text-h2-app)] leading-[var(--text-h2-app--line-height)]">
              Donner un devoir
            </h2>
            <FormulaireDevoir
              cours={cours.map((unCours) => ({ id: unCours.id, libelle: unCours.libelle }))}
              seances={seances}
            />
          </section>

          <section className="mt-12">
            <h2 className="m-0 text-[length:var(--text-h2-app)] leading-[var(--text-h2-app--line-height)]">
              Mes devoirs
            </h2>

            {tries.length === 0 ? (
              <p className="m-0 mt-4 text-[color:var(--color-encre-faible)]">
                Vous n&apos;avez encore donné aucun devoir.
              </p>
            ) : (
              <ul className="m-0 mt-4 list-none space-y-2 p-0" data-testid="liste-devoirs">
                {tries.map((devoir) => (
                  <li key={devoir.id}>
                    <Lien devoir={devoir} cours={libelles.get(devoir.cours) ?? "Cours"} />
                  </li>
                ))}
              </ul>
            )}
          </section>
        </>
      )}
    </>
  );
}

function Lien({ devoir, cours }: { devoir: Devoir; cours: string }) {
  return (
    <Link
      href={`/professeur/devoirs/${devoir.id}`}
      data-testid="devoir-lien"
      data-devoir={devoir.id}
      data-etat={devoir.etat}
      className="flex min-h-[44px] flex-wrap items-center justify-between gap-3 rounded-[var(--radius-carte)] border border-[color:var(--color-bordure)] p-4 no-underline hover:border-[color:var(--color-bordure-forte)]"
    >
      <span className="min-w-0">
        <span className="block font-semibold">{devoir.titre}</span>
        <span className="block text-[length:var(--text-aide)] text-[color:var(--color-encre-faible)]">
          {cours}
          {devoir.echeance === null ? "" : ` — ${instantLisible(devoir.echeance)}`}
        </span>
      </span>

      <span
        className={`pastille ${
          devoir.etat === "brouillon" ? "pastille-brouillon" : "pastille-publie"
        }`}
      >
        {ETATS[devoir.etat] ?? devoir.etat}
      </span>
    </Link>
  );
}
