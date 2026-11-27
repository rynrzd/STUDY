import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Publication, type CoursPubliable } from "@/components/studio/Publication";
import { RenduDocument } from "@/components/studio/RenduDocument";
import { ciblesPublication } from "@/lib/publication";
import { jetonAccesDe, sessionCourante } from "@/lib/session-serveur";
import { document as lireDocument, revision } from "@/lib/studio-documents";
import { FormulaireCreationClasse } from "@/app/professeur/classes/FormulaireCreation";
import { clientUtilisateur } from "@/lib/supabase-serveur";

export const metadata: Metadata = { title: "Publication" };

/**
 * Prêt à publier — S13, cahier des charges ch. 14 (plusieurs cours).
 *
 * L'aperçu à gauche, le choix à droite. Les effectifs viennent de la base, pas
 * d'un nombre écrit à la main : un chiffre faux sur cet écran ferait douter de
 * tout le reste.
 */
export const dynamic = "force-dynamic";

export default async function PagePublication({
  params,
  searchParams,
}: {
  params: Promise<{ document: string }>;
  searchParams: Promise<{ revision?: string }>;
}) {
  const personne = await sessionCourante();
  if (personne === null) redirect("/connexion");

  const jeton = await jetonAccesDe(personne);
  if (jeton === null) redirect("/connexion");

  const { document: id } = await params;
  const doc = await lireDocument(jeton, id);
  if (doc === null || doc.revisionId === null) notFound();
  const attendue = (await searchParams).revision;
  if (attendue && attendue !== doc.revisionId) {
    return (
      <div className="panneau" role="status">
        <p>Le brouillon a changé dans un autre onglet. Relisez la nouvelle version avant de publier.</p>
        <Link href={`/professeur/studio/${id}/publication`} className="bouton bouton-primaire">Relire la révision courante</Link>
      </div>
    );
  }

  // Les cours et leurs effectifs viennent de la base : seulement ceux où la
  // personne enseigne aujourd'hui, classes et groupes, élèves réellement inscrits.
  const [courante, cibles, organisation] = await Promise.all([
    revision(jeton, doc.revisionId),
    ciblesPublication(personne.profileId, id),
    personne.organizationId
      ? clientUtilisateur(jeton).from("organizations").select("autonome").eq("id", personne.organizationId).maybeSingle()
      : null,
  ]);

  if (courante === null) notFound();

  const publiables: CoursPubliable[] = (cibles ?? []).map((c) => ({
    id: c.id,
    matiere: c.matiere,
    cible: c.cible,
    genre: c.genre,
    effectif: c.effectif,
    dejaPublie: c.dejaPublie,
    versionAJour: c.versionAJour,
    programmeePour: c.programmeePour,
    seance: c.seance,
  }));

  return (
    <>
      <p className="m-0">
        <Link
          href={`/professeur/studio/${id}`}
          className="text-[length:var(--text-tableau)] text-[color:var(--color-encre-faible)] no-underline hover:text-[color:var(--color-accent)]"
        >
          ← Mise en page
        </Link>
      </p>

      <h1 className="mt-4 text-[length:var(--text-h2)] leading-[var(--text-h2--line-height)] tracking-[-0.02em]">
        Prêt à publier.
      </h1>

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
        <div className="rounded-[var(--radius-carte)] border border-[color:var(--color-bordure)] bg-[color:var(--color-surface)] p-6 shadow-[var(--shadow-flottant)] sm:p-10">
          <RenduDocument document={courante.document} reglages={courante.reglages} revisionId={courante.id} />
        </div>

        <aside className="lg:sticky lg:top-24">
          {publiables.length > 0 || !organisation?.data?.autonome || cibles === null ? (
            <Publication document={id} titre={courante.document.titre} cours={publiables} lectureEchouee={cibles === null} />
          ) : null}
          {organisation?.data?.autonome && cibles !== null ? (
            <details className="mt-5" open={publiables.length === 0}>
              <summary className="cursor-pointer font-semibold">Créer une classe et une matière</summary>
              <div className="mt-3"><FormulaireCreationClasse retour={{ document: id, revision: courante.id }} /></div>
            </details>
          ) : null}

          <div className="mt-8 border-t border-[color:var(--color-bordure)] pt-5">
            <h2 className="m-0 text-[length:var(--text-aide)] font-semibold uppercase tracking-[0.08em] text-[color:var(--color-encre-faible)]">
              Voir le cours comme
            </h2>
            <ul className="m-0 mt-3 flex list-none gap-2 p-0">
              {[
                ["", "Élève"],
                ["?mode=projection", "Projection"],
                ["?mode=a4", "A4"],
              ].map(([suffixe, libelle]) => (
                <li key={libelle}>
                  <Link
                    href={`/professeur/studio/${id}/apercu${suffixe}`}
                    className="inline-flex min-h-9 items-center rounded-[var(--radius-champ)] border border-[color:var(--color-bordure)] px-3 text-[length:var(--text-tableau)] no-underline"
                  >
                    {libelle}
                  </Link>
                </li>
              ))}
            </ul>
            <p className="m-0 mt-3 text-[length:var(--text-aide)] leading-[var(--text-aide--line-height)] text-[color:var(--color-encre-tres-faible)]">
              La vue A4 permet de télécharger le fichier PDF ou d’imprimer depuis le navigateur.
            </p>
          </div>
        </aside>
      </div>
    </>
  );
}
