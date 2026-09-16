import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Depot } from "@/components/studio/Depot";
import { jetonAccesDe, sessionCourante } from "@/lib/session-serveur";
import { mesDocuments, type DocumentStudio } from "@/lib/studio-documents";

export const metadata: Metadata = { title: "Studio" };

/**
 * Accueil du Studio — S02.
 *
 * Le dépôt d'abord, la liste ensuite : ce que le professeur vient faire, c'est
 * importer. La liste vide invite à importer, et n'affiche aucun exemple — un
 * faux cours dans une liste de vrais cours est une confusion garantie le jour
 * où l'on cherche vite.
 */
export const dynamic = "force-dynamic";

const ETATS: Record<DocumentStudio["etat"], { libelle: string; pastille: string; action: string }> =
  {
    importe: { libelle: "Transfert", pastille: "pastille-brouillon", action: "Ouvrir" },
    traitement: { libelle: "Lecture du document", pastille: "pastille-attention", action: "Suivre" },
    a_verifier: { libelle: "À vérifier", pastille: "pastille-attention", action: "Vérifier" },
    pret: { libelle: "Prêt", pastille: "pastille-publie", action: "Ouvrir" },
    echec: { libelle: "Échec", pastille: "pastille-erreur", action: "Voir" },
  };

export default async function PageStudioDocuments() {
  const personne = await sessionCourante();
  if (personne === null) redirect("/connexion");

  const jeton = await jetonAccesDe(personne);
  if (jeton === null) redirect("/connexion");

  const documents = await mesDocuments(jeton);

  return (
    <>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <h1 className="text-[length:var(--text-h2)] leading-[var(--text-h2--line-height)] tracking-[-0.02em]">
            Vos cours, bien présentés.
          </h1>
          <p className="m-0 mt-2 max-w-[52ch] text-[length:var(--text-corps)] text-[color:var(--color-encre-faible)]">
            Importez votre document. Gardez le contenu, choisissez la
            présentation.
          </p>
        </div>
      </div>

      <div className="mt-8">
        <Depot />
      </div>

      <section className="mt-12">
        <h2 className="text-[length:var(--text-h2-app)] leading-[var(--text-h2-app--line-height)]">
          Mes derniers cours
        </h2>

        {documents.length === 0 ? (
          <p className="m-0 mt-4 max-w-[var(--spacing-lecture)] text-[color:var(--color-encre-faible)]">
            Rien pour l&apos;instant. Déposez un cours au format PDF ou Word : il
            sera lu, mis en page, et vous pourrez le vérifier avant de le
            publier dans une classe.
          </p>
        ) : (
          <ul className="m-0 mt-4 list-none p-0">
            {documents.map((document) => {
              const etat = ETATS[document.etat];
              return (
                <li key={document.id}>
                  <Link
                    href={`/professeur/studio/${document.id}`}
                    className="flex min-h-[var(--spacing-cible)] flex-wrap items-center justify-between gap-3 border-b border-[color:var(--color-bordure)] px-1 py-3.5 no-underline transition-colors duration-[120ms] hover:bg-[color:var(--color-survol)]"
                  >
                    <span className="min-w-0 flex-1">
                      <span className="block truncate font-medium text-[color:var(--color-encre)]">
                        {document.titre}
                      </span>
                      <span className="mt-0.5 block text-[length:var(--text-aide)] text-[color:var(--color-encre-tres-faible)]">
                        {new Date(document.majLe).toLocaleDateString("fr-FR", {
                          day: "numeric",
                          month: "long",
                        })}
                      </span>
                    </span>

                    <span className={`pastille ${etat.pastille}`}>{etat.libelle}</span>

                    <span className="whitespace-nowrap text-[length:var(--text-tableau)] font-medium text-[color:var(--color-accent)]">
                      {etat.action} →
                    </span>
                  </Link>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </>
  );
}
