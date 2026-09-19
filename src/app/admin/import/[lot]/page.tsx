import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { VerificationRentree } from "@/components/admin/VerificationRentree";
import { contexte } from "@/lib/etablissement";
import { lireLot } from "@/lib/lot-rentree";
import { sessionCourante } from "@/lib/session-serveur";

/**
 * Vérification d'un lot — cahier V5, §5.2 à §5.7.
 *
 * L'identifiant du lot vient de l'adresse, donc il est traité comme une
 * saisie : `lireLot` recalcule l'établissement de la personne connectée et
 * rend `null` si le lot appartient à un autre lycée. Le 404 qui suit ne
 * distingue pas « n'existe pas » de « pas à vous » — c'est voulu.
 */
export const dynamic = "force-dynamic";

export default async function PageVerification({
  params,
}: {
  params: Promise<{ lot: string }>;
}) {
  const personne = await sessionCourante();
  if (personne === null) redirect("/connexion");

  const situation = await contexte(personne.profileId);
  if (situation === null) redirect("/admin");

  const { lot: identifiant } = await params;
  const lot = await lireLot(personne.profileId, identifiant);
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
          Vérifier avant de créer
        </h1>
        <p className="m-0 mt-2 max-w-[70ch] text-[color:var(--color-encre-faible)]">
          Relisez ce qui a été compris de vos fichiers. Corrigez ce qui doit
          l&apos;être. Les comptes ne seront créés qu&apos;au dernier bouton.
        </p>
      </div>

      <div className="mt-8">
        <VerificationRentree lot={lot} codeEtablissement={situation.publicCode} />
      </div>
    </div>
  );
}
