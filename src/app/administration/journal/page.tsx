import { redirect } from "next/navigation";
import { listerJournal } from "@/lib/administration";
import { estExploitant, sessionCourante } from "@/lib/session-serveur";

/**
 * Journal d'audit.
 *
 * Lecture seule, et pas seulement par convention : la table porte un déclencheur
 * qui fait échouer toute modification ou suppression. Un journal qu'on peut
 * corriger après coup ne prouve rien.
 */
export const dynamic = "force-dynamic";

const LIBELLES: Record<string, string> = {
  amorcage_exploitant: "Création du compte propriétaire",
  creation_etablissement: "Création d'un établissement",
  changement_etat_etablissement: "Changement d'état d'un établissement",
  creation_administrateur: "Création d'un administrateur",
  suspension_compte: "Suspension d'un compte",
};

export default async function PageJournal() {
  const personne = await sessionCourante();
  if (personne === null || !estExploitant(personne)) redirect("/connexion");

  const evenements = await listerJournal(personne.profileId, 200);

  return (
    <>
      <h1 className="text-[length:var(--text-h1-app)] leading-[var(--text-h1-app--line-height)]">
        Journal d&apos;audit
      </h1>
      <p className="m-0 mt-2 max-w-[70ch] text-[length:var(--text-tableau)] text-[color:var(--color-encre-faible)]">
        Les actions sensibles, dans l&apos;ordre où elles se sont produites. Ce
        journal est immuable : il ne peut être ni modifié, ni effacé, y compris
        depuis ce compte.
      </p>

      {evenements.length === 0 ? (
        <div className="carte mt-8 p-8 text-center">
          <p className="m-0 font-semibold">Aucune action enregistrée.</p>
        </div>
      ) : (
        <div className="carte mt-8 overflow-x-auto">
          <table className="w-full min-w-[52rem] border-collapse text-[length:var(--text-tableau)]">
            <caption className="sr-only">Actions sensibles enregistrées</caption>
            <thead>
              <tr className="border-b border-[color:var(--color-bordure-forte)] text-left">
                <th scope="col" className="p-3 font-semibold">Date</th>
                <th scope="col" className="p-3 font-semibold">Action</th>
                <th scope="col" className="p-3 font-semibold">Établissement</th>
                <th scope="col" className="p-3 font-semibold">Auteur</th>
                <th scope="col" className="p-3 font-semibold">Motif</th>
              </tr>
            </thead>
            <tbody>
              {evenements.map((evenement) => (
                <tr key={evenement.id} className="border-b border-[color:var(--color-bordure)]">
                  <td className="whitespace-nowrap p-3 text-[color:var(--color-encre-faible)]">
                    {horodatage(evenement.created_at)}
                  </td>
                  <th scope="row" className="p-3 text-left font-normal">
                    {LIBELLES[evenement.action] ?? evenement.action}
                  </th>
                  <td className="p-3 text-[color:var(--color-encre-faible)]">
                    {evenement.organisation ?? "—"}
                  </td>
                  <td className="p-3 text-[color:var(--color-encre-faible)]">
                    {evenement.acteur ?? "système"}
                  </td>
                  <td className="p-3 text-[color:var(--color-encre-faible)]">
                    {evenement.reason ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}

function horodatage(iso: string): string {
  return new Date(iso).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
