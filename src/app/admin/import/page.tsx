import { redirect } from "next/navigation";
import { Import } from "@/components/admin/Import";
import { contexte } from "@/lib/etablissement";
import { sessionCourante } from "@/lib/session-serveur";

/**
 * Import de rentrée.
 *
 * Trois étapes visibles : déposer, vérifier, confirmer. Et une quatrième,
 * moins visible mais décisive : imprimer les accès, parce qu'ils ne seront
 * plus affichés ensuite.
 */
export const dynamic = "force-dynamic";

export default async function PageImport() {
  const personne = await sessionCourante();
  if (personne === null) redirect("/connexion");

  const situation = await contexte(personne.profileId);
  if (situation === null) redirect("/admin");

  return (
    <>
      <div className="print:hidden">
        <h1 className="text-[length:var(--text-h1-app)] leading-[var(--text-h1-app--line-height)]">
          Import de rentrée
        </h1>
        <p className="m-0 mt-2 max-w-[70ch] text-[color:var(--color-encre-faible)]">
          Déposez votre fichier d&apos;élèves. Vous verrez d&apos;abord un
          aperçu : classes détectées, identifiants proposés, lignes à corriger.
          Rien n&apos;est créé tant que vous n&apos;avez pas confirmé.
        </p>
      </div>

      <div className="mt-8">
        <Import codeEtablissement={situation.publicCode} />
      </div>
    </>
  );
}
