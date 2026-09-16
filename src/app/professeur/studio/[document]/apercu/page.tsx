import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { RenduDocument, type ModeRendu } from "@/components/studio/RenduDocument";
import { jetonAccesDe, sessionCourante } from "@/lib/session-serveur";
import { document as lireDocument, revision } from "@/lib/studio-documents";

export const metadata: Metadata = { title: "Aperçu", robots: { index: false, follow: false } };

/**
 * Aperçu — S16.
 *
 * Trois modes, un seul contenu : le même composant, les mêmes blocs. La
 * projection agrandit et dépouille ; la vue A4 prépare l'impression. Rien
 * n'est régénéré, rien n'est reformulé, aucune requête de conversion n'est
 * relancée.
 *
 * Aucun panneau d'administration ni correction privée n'apparaît en projection
 * (P07) : cet écran est celui qu'on met au tableau devant trente personnes.
 */
export const dynamic = "force-dynamic";

const MODES: Record<string, ModeRendu> = {
  eleve: "ecran",
  projection: "projection",
  a4: "a4",
};

export default async function PageApercu({
  params,
  searchParams,
}: {
  params: Promise<{ document: string }>;
  searchParams: Promise<{ mode?: string }>;
}) {
  const personne = await sessionCourante();
  if (personne === null) redirect("/connexion");

  const jeton = await jetonAccesDe(personne);
  if (jeton === null) redirect("/connexion");

  const { document: id } = await params;
  const doc = await lireDocument(jeton, id);
  if (doc === null || doc.revisionId === null) notFound();

  const courante = await revision(jeton, doc.revisionId);
  if (courante === null) notFound();

  const { mode: demande } = await searchParams;
  const mode = MODES[demande ?? "eleve"] ?? "ecran";

  return (
    <div className={mode === "projection" ? "bg-[color:var(--color-surface)]" : ""}>
      <div className="flex flex-wrap items-center justify-between gap-3 print:hidden">
        <Link
          href={`/professeur/studio/${id}/publication`}
          className="text-[length:var(--text-tableau)] text-[color:var(--color-encre-faible)] no-underline hover:text-[color:var(--color-accent)]"
        >
          ← Publication
        </Link>

        <nav aria-label="Mode d'aperçu">
          <ul className="m-0 flex list-none gap-2 p-0">
            {[
              ["eleve", "Élève"],
              ["projection", "Projection"],
              ["a4", "A4"],
            ].map(([cle, libelle]) => (
              <li key={cle}>
                <Link
                  href={`/professeur/studio/${id}/apercu?mode=${cle}`}
                  aria-current={(demande ?? "eleve") === cle ? "page" : undefined}
                  className={`inline-flex min-h-9 items-center rounded-[var(--radius-champ)] border px-3 text-[length:var(--text-tableau)] no-underline ${
                    (demande ?? "eleve") === cle
                      ? "border-[color:var(--color-accent)] bg-[color:var(--color-rose-clair)] font-semibold text-[color:var(--color-accent)]"
                      : "border-[color:var(--color-bordure)]"
                  }`}
                >
                  {libelle}
                </Link>
              </li>
            ))}
          </ul>
        </nav>
      </div>

      <div
        className={
          mode === "a4"
            ? "mx-auto mt-8 w-full max-w-[210mm] bg-white p-[12mm] shadow-[var(--shadow-flottant)] print:mt-0 print:p-0 print:shadow-none"
            : mode === "projection"
              ? "mt-12"
              : "mx-auto mt-8 w-full max-w-[860px] rounded-[var(--radius-carte)] border border-[color:var(--color-bordure)] bg-[color:var(--color-surface)] p-6 sm:p-10"
        }
      >
        <RenduDocument document={courante.document} reglages={courante.reglages} mode={mode} />
      </div>

      {mode === "a4" ? (
        <p className="m-0 mt-6 text-center text-[length:var(--text-aide)] text-[color:var(--color-encre-tres-faible)] print:hidden">
          Utilisez l&apos;impression de votre navigateur pour obtenir un PDF.
        </p>
      ) : null}
    </div>
  );
}
