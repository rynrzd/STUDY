import Link from "next/link";
import { redirect } from "next/navigation";
import { DepotRentree } from "@/components/admin/DepotRentree";
import { contexte } from "@/lib/etablissement";
import { historiqueImports } from "@/lib/lot-rentree";
import { sessionCourante } from "@/lib/session-serveur";

/**
 * Assistant de rentrée — le dépôt (cahier V5, §5.1).
 *
 * Trois moments : déposer, vérifier, créer. Celui-ci ne fait rien d'autre que
 * lire. Aucun compte, aucune classe n'existe avant la validation explicite de
 * l'écran suivant.
 */
export const dynamic = "force-dynamic";

export default async function PageImport() {
  const personne = await sessionCourante();
  if (personne === null) redirect("/connexion");

  const situation = await contexte(personne.profileId);
  if (situation === null) redirect("/admin");

  const historique = await historiqueImports(personne.profileId);
  const enCours = historique.filter((lot) => lot.state !== "applique" && lot.state !== "abandonne");
  const passes = historique.filter((lot) => lot.state === "applique");

  return (
    <div className="max-w-[72rem]">
      <h1 className="text-[length:var(--text-h1-app)] leading-[var(--text-h1-app--line-height)]">
        Import de rentrée
      </h1>
      <p className="m-0 mt-2 max-w-[70ch] text-[color:var(--color-encre-faible)]">
        Déposez vos fichiers d&apos;élèves, puis ceux de vos professeurs. Vous
        verrez d&apos;abord ce qui a été compris — classes détectées, colonnes
        reconnues, lignes à corriger — et rien ne sera créé tant que vous
        n&apos;aurez pas validé.
      </p>

      <section aria-labelledby="titre-eleves" className="mt-10">
        <h2
          id="titre-eleves"
          className="text-[length:var(--text-h3)] leading-[var(--text-h3--line-height)]"
        >
          Élèves
        </h2>
        <div className="mt-4">
          <DepotRentree cible="eleves" />
        </div>
      </section>

      <section aria-labelledby="titre-profs" className="mt-12">
        <h2
          id="titre-profs"
          className="text-[length:var(--text-h3)] leading-[var(--text-h3--line-height)]"
        >
          Professeurs
        </h2>
        <p className="m-0 mt-2 max-w-[70ch] text-[length:var(--text-aide)] leading-[var(--text-aide--line-height)] text-[color:var(--color-encre-faible)]">
          Nom, prénom, matière et classes. Un professeur qui enseigne dans
          plusieurs classes n&apos;aura qu&apos;un compte, avec une affectation
          par classe.
        </p>
        <div className="mt-4">
          <DepotRentree cible="professeurs" />
        </div>
      </section>

      {enCours.length > 0 ? (
        <section aria-labelledby="titre-en-cours" className="mt-12">
          <h2
            id="titre-en-cours"
            className="text-[length:var(--text-h3)] leading-[var(--text-h3--line-height)]"
          >
            Imports commencés, pas encore validés
          </h2>
          <ul className="m-0 mt-4 list-none space-y-2 p-0">
            {enCours.map((lot) => (
              <li key={lot.id}>
                <Link
                  href={adresseDuLot(lot)}
                  className="flex flex-wrap items-center justify-between gap-2 rounded-[var(--radius-champ)] border border-[color:var(--color-bordure)] px-4 py-3 text-[length:var(--text-tableau)] hover:border-[color:var(--color-accent)]"
                >
                  <span>
                    {lot.kind === "enseignants" ? "Professeurs" : "Élèves"} · déposé le{" "}
                    {dateLisible(lot.created_at)}
                  </span>
                  <span className="text-[color:var(--color-encre-faible)]">
                    Reprendre la vérification
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {passes.length > 0 ? (
        <section aria-labelledby="titre-passes" className="mt-12">
          <h2
            id="titre-passes"
            className="text-[length:var(--text-h3)] leading-[var(--text-h3--line-height)]"
          >
            Imports passés
          </h2>
          <div className="mt-4 overflow-x-auto rounded-[var(--radius-champ)] border border-[color:var(--color-bordure)]">
            <table className="w-full min-w-[30rem] border-collapse text-[length:var(--text-tableau)]">
              <caption className="sr-only">Historique des imports de l&apos;établissement</caption>
              <thead className="bg-[color:var(--color-surface-douce)]">
                <tr className="text-left">
                  <th scope="col" className="p-2.5 font-semibold">Date</th>
                  <th scope="col" className="p-2.5 font-semibold">Type</th>
                  <th scope="col" className="p-2.5 font-semibold">Créés</th>
                  <th scope="col" className="p-2.5 font-semibold">Déjà présents</th>
                  <th scope="col" className="p-2.5 font-semibold">En erreur</th>
                </tr>
              </thead>
              <tbody>
                {passes.map((lot) => (
                  <tr key={lot.id} className="border-t border-[color:var(--color-bordure)]">
                    <td className="p-2.5">{dateLisible(lot.applied_at ?? lot.created_at)}</td>
                    <td className="p-2.5 text-[color:var(--color-encre-faible)]">
                      {lot.kind === "enseignants" ? "Professeurs" : "Élèves"}
                    </td>
                    <td className="p-2.5">{lot.rapport?.cree ?? 0}</td>
                    <td className="p-2.5 text-[color:var(--color-encre-faible)]">
                      {lot.rapport?.existant ?? 0}
                    </td>
                    <td className="p-2.5 text-[color:var(--color-encre-faible)]">
                      {lot.rapport?.erreur ?? 0}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}
    </div>
  );
}

/** Le lot d’élèves et celui de professeurs ne se relisent pas au même endroit. */
function adresseDuLot(lot: { id: string; kind: string }): string {
  return lot.kind === "enseignants"
    ? `/admin/import/profs/${lot.id}`
    : `/admin/import/${lot.id}`;
}

function dateLisible(valeur: string): string {
  return new Date(valeur).toLocaleDateString("fr-FR", {
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}
