import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Publication, type CoursPubliable } from "@/components/studio/Publication";
import { RenduDocument } from "@/components/studio/RenduDocument";
import { effectifsParClasse } from "@/lib/espace-professeur";
import { jetonAccesDe, sessionCourante } from "@/lib/session-serveur";
import { coursDuProfesseur } from "@/lib/studio";
import { document as lireDocument, revision } from "@/lib/studio-documents";
import { clientUtilisateur } from "@/lib/supabase-serveur";

export const metadata: Metadata = { title: "Publication" };

/**
 * Prêt pour votre classe — S13.
 *
 * L'aperçu à gauche, le choix à droite. Les effectifs viennent de la base, pas
 * d'un nombre écrit à la main : un chiffre faux sur cet écran ferait douter de
 * tout le reste.
 */
export const dynamic = "force-dynamic";

export default async function PagePublication({
  params,
}: {
  params: Promise<{ document: string }>;
}) {
  const personne = await sessionCourante();
  if (personne === null) redirect("/connexion");

  const jeton = await jetonAccesDe(personne);
  if (jeton === null) redirect("/connexion");

  const { document: id } = await params;
  const doc = await lireDocument(jeton, id);
  if (doc === null || doc.revisionId === null) notFound();

  const [courante, cours, effectifs, dejaPubliees] = await Promise.all([
    revision(jeton, doc.revisionId),
    coursDuProfesseur(jeton),
    effectifsParClasse(jeton),
    lireDejaPubliees(jeton, id),
  ]);

  if (courante === null) notFound();

  const publiables: CoursPubliable[] = cours.map((entree) => ({
    id: entree.id,
    libelle: entree.libelle,
    effectif: effectifs.get(entree.classe ?? "") ?? 0,
    dejaPublie: dejaPubliees.has(entree.id),
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
        Prêt pour votre classe.
      </h1>

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_320px] lg:items-start">
        <div className="rounded-[var(--radius-carte)] border border-[color:var(--color-bordure)] bg-[color:var(--color-surface)] p-6 shadow-[var(--shadow-flottant)] sm:p-10">
          <RenduDocument document={courante.document} reglages={courante.reglages} />
        </div>

        <aside className="lg:sticky lg:top-24">
          <Publication document={id} titre={doc.titre} cours={publiables} />

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
              La vue A4 s&apos;imprime depuis votre navigateur, ou s&apos;y
              enregistre en PDF. AvecStudy ne produit pas encore de fichier PDF
              de son côté.
            </p>
          </div>
        </aside>
      </div>
    </>
  );
}

/** Les cours où ce document est déjà publié : on le signale, on ne l'empêche pas. */
async function lireDejaPubliees(jeton: string, document: string): Promise<Set<string>> {
  const { data, error } = await clientUtilisateur(jeton)
    .from("lessons")
    .select("teaching_space_id")
    .eq("origin_studio_document", document)
    .is("archived_at", null)
    .limit(40);

  if (error !== null) return new Set();
  return new Set(
    ((data ?? []) as unknown as { teaching_space_id: string }[]).map(
      (ligne) => ligne.teaching_space_id,
    ),
  );
}
