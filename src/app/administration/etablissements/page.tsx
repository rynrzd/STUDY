import { FicheEtablissement } from "@/components/administration/FicheEtablissement";
import { FormulaireEtablissement } from "@/components/administration/FormulaireEtablissement";
import { listerEtablissements, listerMembres, proposerCode } from "@/lib/administration";

/**
 * Établissements.
 *
 * Un établissement naît à l'état « préparation » : il existe, son
 * administrateur peut être créé, mais personne ne s'y connecte tant qu'il n'est
 * pas passé à « actif ». C'est ce qui permet de préparer une rentrée sans
 * ouvrir l'accès trop tôt.
 */
export const dynamic = "force-dynamic";

export default async function PageEtablissements() {
  const etablissements = await listerEtablissements();

  const membresParEtablissement = await Promise.all(
    etablissements.map(async (etablissement) => ({
      id: etablissement.id,
      membres: await listerMembres(etablissement.id),
    })),
  );

  const membres = new Map(membresParEtablissement.map((entree) => [entree.id, entree.membres]));

  return (
    <>
      <h1 className="text-[length:var(--text-h1-app)] leading-[var(--text-h1-app--line-height)]">
        Établissements
      </h1>
      <p className="m-0 mt-2 text-[length:var(--text-tableau)] text-[color:var(--color-encre-faible)]">
        {etablissements.length === 0
          ? "Aucun établissement enregistré."
          : `${etablissements.length} établissement${etablissements.length > 1 ? "s" : ""}.`}
      </p>

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_380px] lg:items-start">
        <div>
          {etablissements.length === 0 ? (
            <div className="carte p-8 text-center">
              <p className="m-0 font-semibold">Rien à afficher pour l&apos;instant.</p>
              <p className="m-0 mt-2 text-[length:var(--text-tableau)] text-[color:var(--color-encre-faible)]">
                Créez le premier établissement avec le formulaire ci-contre.
              </p>
            </div>
          ) : (
            <ul className="m-0 list-none space-y-4 p-0">
              {etablissements.map((etablissement) => (
                <li key={etablissement.id}>
                  <FicheEtablissement
                    etablissement={etablissement}
                    membres={membres.get(etablissement.id) ?? []}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>

        <FormulaireEtablissement codePropose={proposerCode("Lycée")} />
      </div>
    </>
  );
}
