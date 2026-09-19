import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { VerificationProfesseurs } from "@/components/admin/VerificationProfesseurs";
import { contexte } from "@/lib/etablissement";
import { lireLotProfesseurs } from "@/lib/lot-professeurs";
import { sessionCourante } from "@/lib/session-serveur";

/**
 * Vérification d'un lot de professeurs — cahier V5, §6.
 *
 * Comme pour les élèves, l'identifiant vient de l'adresse et n'est jamais cru
 * sur parole : `lireLotProfesseurs` recalcule l'établissement de la personne
 * connectée, et rend `null` pour un lot d'ailleurs — ou pour un lot d'élèves
 * ouvert par cette adresse.
 */
export const dynamic = "force-dynamic";

export default async function PageVerificationProfesseurs({
  params,
}: {
  params: Promise<{ lot: string }>;
}) {
  const personne = await sessionCourante();
  if (personne === null) redirect("/connexion");

  const situation = await contexte(personne.profileId);
  if (situation === null) redirect("/admin");

  const { lot: identifiant } = await params;
  const lot = await lireLotProfesseurs(personne.profileId, identifiant);
  if (lot === null) notFound();

  return (
    <div className="max-w-[72rem]">
      <div className="print:hidden">
        <Link
          href="/admin/import"
          className="text-[length:var(--text-aide)] text-[color:var(--color-encre-faible)] underline underline-offset-2"
        >
          ← Imports
        </Link>
        <h1 className="mt-2 text-[length:var(--text-h1-app)] leading-[var(--text-h1-app--line-height)]">
          Professeurs et affectations
        </h1>
        <p className="m-0 mt-2 max-w-[70ch] text-[color:var(--color-encre-faible)]">
          Relisez qui enseigne quoi, et où. Chaque affectation ouvre un cours,
          et seulement celui-là.
        </p>
      </div>

      <div className="mt-8">
        <VerificationProfesseurs lot={lot} codeEtablissement={situation.publicCode} />
      </div>
    </div>
  );
}
