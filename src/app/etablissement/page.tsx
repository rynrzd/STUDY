import Link from "next/link";
import { redirect } from "next/navigation";
import { classes, contexte, membres } from "@/lib/etablissement";
import { sessionCourante } from "@/lib/session-serveur";

/**
 * Vue d'ensemble de l'établissement : classes, comptes, état.
 *
 * Aucun chiffre décoratif : ce qui est affiché est compté en base au moment du
 * rendu. Une page d'administration qui affiche un total approximatif fait
 * douter de tout le reste.
 */
export const dynamic = "force-dynamic";

export default async function PageEtablissement() {
  const personne = await sessionCourante();
  if (personne === null) redirect("/connexion");

  const situation = await contexte(personne.profileId);
  if (situation === null) {
    return (
      <div className="carte p-8">
        <h1 className="text-[length:var(--text-h1-app)] leading-[var(--text-h1-app--line-height)]">
          Établissement indisponible
        </h1>
        <p className="m-0 mt-3 max-w-[60ch] text-[color:var(--color-encre-faible)]">
          Votre compte n&apos;administre aucun établissement actif. Si votre
          établissement vient d&apos;être créé, il est peut-être encore à
          l&apos;état « préparation ».
        </p>
      </div>
    );
  }

  const [listeClasses, listeMembres] = await Promise.all([
    classes(personne.profileId),
    membres(personne.profileId),
  ]);

  const eleves = listeMembres.filter((membre) => membre.roles.includes("eleve"));
  const enseignants = listeMembres.filter((membre) => membre.roles.includes("professeur"));
  const aActiver = listeMembres.filter((membre) => membre.account_state === "a_activer");

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-[length:var(--text-h1-app)] leading-[var(--text-h1-app--line-height)]">
            {situation.organisation}
          </h1>
          <p className="m-0 mt-2 text-[length:var(--text-tableau)] text-[color:var(--color-encre-faible)]">
            Code <span className="font-mono font-semibold">{situation.publicCode}</span>
            {situation.anneeLabel === null ? "" : ` · année ${situation.anneeLabel}`}
            {situation.etat === "actif" ? "" : ` · ${situation.etat}`}
          </p>
        </div>

        <Link href="/etablissement/import" className="bouton bouton-primaire">
          Importer les classes
          <span aria-hidden="true" className="fleche">→</span>
        </Link>
      </div>

      <dl className="m-0 mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Compteur terme="Classes" valeur={listeClasses.length} />
        <Compteur terme="Élèves" valeur={eleves.length} />
        <Compteur terme="Enseignants" valeur={enseignants.length} />
        <Compteur terme="Comptes à activer" valeur={aActiver.length} />
      </dl>

      <section className="mt-10">
        <h2 className="text-[length:var(--text-h2-app)] leading-[var(--text-h2-app--line-height)]">
          Classes
        </h2>

        {listeClasses.length === 0 ? (
          <div className="carte mt-4 p-8 text-center">
            <p className="m-0 font-semibold">Aucune classe pour l&apos;instant.</p>
            <p className="m-0 mt-2 text-[length:var(--text-tableau)] text-[color:var(--color-encre-faible)]">
              L&apos;import de rentrée crée les classes et les élèves à partir de
              votre fichier.
            </p>
            <Link href="/etablissement/import" className="bouton bouton-secondaire mt-5">
              Commencer l&apos;import
            </Link>
          </div>
        ) : (
          <ul className="m-0 mt-4 grid list-none gap-3 p-0 sm:grid-cols-2 lg:grid-cols-3">
            {listeClasses.map((classe) => (
              <li key={classe.id} className="carte p-5">
                <p className="m-0 font-semibold">{classe.label}</p>
                <p className="m-0 mt-1 text-[length:var(--text-tableau)] text-[color:var(--color-encre-faible)]">
                  {classe.effectif} élève{classe.effectif > 1 ? "s" : ""}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      {listeMembres.length > 0 ? (
        <section className="mt-12">
          <h2 className="text-[length:var(--text-h2-app)] leading-[var(--text-h2-app--line-height)]">
            Comptes
          </h2>
          <div className="carte mt-4 overflow-x-auto">
            <table className="w-full min-w-[42rem] border-collapse text-[length:var(--text-tableau)]">
              <caption className="sr-only">Comptes de l&apos;établissement</caption>
              <thead>
                <tr className="border-b border-[color:var(--color-bordure-forte)] text-left">
                  <th scope="col" className="p-3 font-semibold">Personne</th>
                  <th scope="col" className="p-3 font-semibold">Identifiant</th>
                  <th scope="col" className="p-3 font-semibold">Rôle</th>
                  <th scope="col" className="p-3 font-semibold">Classe</th>
                  <th scope="col" className="p-3 font-semibold">État</th>
                </tr>
              </thead>
              <tbody>
                {listeMembres.slice(0, 300).map((membre) => (
                  <tr key={membre.profile_id} className="border-b border-[color:var(--color-bordure)]">
                    <th scope="row" className="p-3 text-left font-normal">
                      {membre.prenom} {membre.nom}
                    </th>
                    <td className="p-3 font-mono text-[color:var(--color-encre-faible)]">
                      {membre.local_login}
                    </td>
                    <td className="p-3 text-[color:var(--color-encre-faible)]">
                      {membre.roles.join(", ")}
                    </td>
                    <td className="p-3 text-[color:var(--color-encre-faible)]">
                      {membre.classe ?? "—"}
                    </td>
                    <td className="p-3 text-[color:var(--color-encre-faible)]">
                      {membre.account_state === "a_activer" ? "À activer" : "Actif"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {listeMembres.length > 300 ? (
            <p className="m-0 mt-3 text-[length:var(--text-aide)] text-[color:var(--color-encre-faible)]">
              300 premiers comptes affichés sur {listeMembres.length}.
            </p>
          ) : null}
        </section>
      ) : null}
    </>
  );
}

function Compteur({ terme, valeur }: { terme: string; valeur: number }) {
  return (
    <div className="carte p-5">
      <dt className="m-0 text-[length:var(--text-aide)] text-[color:var(--color-encre-faible)]">
        {terme}
      </dt>
      <dd className="m-0 mt-1 text-[1.75rem] font-bold leading-tight">{valeur}</dd>
    </div>
  );
}
