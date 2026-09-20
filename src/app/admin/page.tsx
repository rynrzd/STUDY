import Link from "next/link";
import { redirect } from "next/navigation";
import { TitreEspace, Vide } from "@/components/app/Cadre";
import { affectations, classes, contexte, membres } from "@/lib/etablissement";
import { historiqueImports } from "@/lib/lot-rentree";
import { sessionCourante } from "@/lib/session-serveur";

/**
 * Tableau de bord de l'établissement — cahier V2, §14.1.
 *
 * Aucun chiffre décoratif : tout ce qui est affiché est compté en base au
 * moment du rendu. Une page d'administration qui affiche un total approximatif
 * fait douter de tout le reste — et c'est cette page qu'un proviseur regarde
 * avant de signer.
 */
export const dynamic = "force-dynamic";

export default async function PageAdmin() {
  const personne = await sessionCourante();
  if (personne === null) redirect("/connexion");

  const situation = await contexte(personne.profileId);
  if (situation === null) {
    return (
      <>
        <TitreEspace titre="Établissement indisponible" />
        <div className="mt-8">
          <Vide
            titre="Votre compte n'administre aucun établissement actif."
            texte="Si votre établissement vient d'être créé, il est peut-être encore à l'état « préparation ». Votre interlocuteur AvecStudy peut l'activer."
          />
        </div>
      </>
    );
  }

  const [listeClasses, listeMembres, listeAffectations, imports] = await Promise.all([
    classes(personne.profileId),
    membres(personne.profileId),
    affectations(personne.profileId),
    historiqueImports(personne.profileId),
  ]);

  const eleves = listeMembres.filter((membre) => membre.roles.includes("eleve"));
  const enseignants = listeMembres.filter((membre) => membre.roles.includes("professeur"));
  const aActiver = listeMembres.filter((membre) => membre.account_state === "a_activer");
  const sansProfesseur = listeAffectations.filter((lien) => lien.professeur_id === null);

  return (
    <>
      <TitreEspace
        titre={situation.organisation}
        sousTitre={`Code ${situation.publicCode}${
          situation.anneeLabel === null ? "" : ` · année ${situation.anneeLabel}`
        }${situation.etat === "actif" ? "" : ` · ${situation.etat}`}`}
        action={
          <>
            <Link href="/admin/professeurs" className="bouton bouton-secondaire">
              Professeurs
            </Link>
            <Link href="/admin/import" className="bouton bouton-rose">
              Import de rentrée
            </Link>
          </>
        }
      />

      <dl className="m-0 mt-8 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <Compteur terme="Classes" valeur={listeClasses.length} />
        <Compteur terme="Élèves" valeur={eleves.length} />
        <Compteur terme="Professeurs" valeur={enseignants.length} />
        <Compteur terme="Comptes à activer" valeur={aActiver.length} />
      </dl>

      {listeClasses.length === 0 ? (
        <div className="mt-10">
          <Vide
            titre="Votre établissement est vide."
            texte="Deux chemins : l'import de rentrée crée les classes et les élèves à partir d'un fichier, ou vous créez une classe à la main puis y ajoutez les comptes un par un."
            action={
              <>
                <Link href="/admin/import" className="bouton bouton-rose">
                  Importer un fichier
                </Link>
                <Link href="/admin/classes" className="bouton bouton-secondaire">
                  Créer une classe
                </Link>
              </>
            }
          />
        </div>
      ) : (
        <>
          {aActiver.length > 0 || sansProfesseur.length > 0 ? (
            <section className="mt-10">
              <h2 className="text-[length:var(--text-h2-app)] leading-[var(--text-h2-app--line-height)]">
                À traiter
              </h2>
              <ul className="m-0 mt-3 list-none p-0">
                {aActiver.length > 0 ? (
                  <Tache
                    href="/admin/utilisateurs?etat=a_activer"
                    libelle={`${aActiver.length} compte${
                      aActiver.length > 1 ? "s" : ""
                    } n'a jamais été activé`}
                    detail="Remettez la fiche d'accès à la personne concernée : elle choisira son mot de passe à la première connexion."
                  />
                ) : null}
                {sansProfesseur.length > 0 ? (
                  <Tache
                    href="/admin/classes"
                    libelle={`${sansProfesseur.length} cours sans professeur`}
                    detail="Un cours sans professeur affecté n'apparaît dans aucun Studio : personne ne peut y publier de séance."
                  />
                ) : null}
              </ul>
            </section>
          ) : null}

          {imports.length > 0 ? (
            <section className="mt-10">
              <div className="flex flex-wrap items-baseline justify-between gap-3">
                <h2 className="text-[length:var(--text-h2-app)] leading-[var(--text-h2-app--line-height)]">
                  Imports récents
                </h2>
                <Link
                  href="/admin/import"
                  className="text-[length:var(--text-aide)] text-[color:var(--color-accent)]"
                >
                  Tous les imports
                </Link>
              </div>

              <ul className="m-0 mt-4 list-none p-0">
                {imports.slice(0, 5).map((lot) => {
                  const enAttente = lot.state !== "applique" && lot.state !== "abandonne";
                  const rate = (lot.rapport?.erreur ?? 0) > 0;

                  return (
                    <li key={lot.id}>
                      <Link
                        href={
                          lot.kind === "enseignants"
                            ? `/admin/import/profs/${lot.id}`
                            : `/admin/import/${lot.id}`
                        }
                        className="flex flex-wrap items-center justify-between gap-3 border-b border-[color:var(--color-bordure)] px-1 py-3 no-underline transition-colors hover:bg-[color:var(--color-survol)]"
                      >
                        <span className="min-w-0">
                          <span className="block font-medium text-[color:var(--color-encre)]">
                            {lot.kind === "enseignants" ? "Professeurs" : "Élèves"} ·{" "}
                            {new Date(lot.applied_at ?? lot.created_at).toLocaleDateString("fr-FR", {
                              day: "numeric",
                              month: "long",
                            })}
                          </span>
                          <span className="mt-0.5 block text-[length:var(--text-aide)] text-[color:var(--color-encre-faible)]">
                            {enAttente
                              ? "Analysé, pas encore validé"
                              : `${lot.rapport?.cree ?? 0} créé${(lot.rapport?.cree ?? 0) > 1 ? "s" : ""}, ${lot.rapport?.existant ?? 0} déjà présent${(lot.rapport?.existant ?? 0) > 1 ? "s" : ""}`}
                          </span>
                        </span>
                        {enAttente || rate ? (
                          <span
                            className={`pastille ${rate ? "pastille-brouillon" : "pastille-attention"}`}
                          >
                            {rate ? `${lot.rapport?.erreur} en erreur` : "à terminer"}
                          </span>
                        ) : null}
                      </Link>
                    </li>
                  );
                })}
              </ul>
            </section>
          ) : null}

          <section className="mt-10">
            <div className="flex flex-wrap items-baseline justify-between gap-3">
              <h2 className="text-[length:var(--text-h2-app)] leading-[var(--text-h2-app--line-height)]">
                Classes
              </h2>
              <Link
                href="/admin/classes"
                className="text-[length:var(--text-aide)] text-[color:var(--color-accent)]"
              >
                Gérer les classes
              </Link>
            </div>

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
          </section>
        </>
      )}
    </>
  );
}

/* -------------------------------------------------------------------------- */

function Compteur({ terme, valeur }: { terme: string; valeur: number }) {
  return (
    <div className="carte p-5">
      <dt className="m-0 text-[length:var(--text-tableau)] text-[color:var(--color-encre-faible)]">
        {terme}
      </dt>
      <dd className="m-0 mt-1 text-[1.75rem] font-extrabold leading-none tracking-[-0.03em]">
        {valeur}
      </dd>
    </div>
  );
}

function Tache({
  href,
  libelle,
  detail,
}: {
  href: string;
  libelle: string;
  detail: string;
}) {
  return (
    <li>
      <Link
        href={href}
        className="block border-b border-[color:var(--color-bordure)] px-1 py-3.5 no-underline transition-colors hover:bg-[color:var(--color-survol)]"
      >
        <span className="block font-medium text-[color:var(--color-encre)]">{libelle}</span>
        <span className="mt-0.5 block max-w-[var(--spacing-lecture)] text-[length:var(--text-aide)] leading-[var(--text-aide--line-height)] text-[color:var(--color-encre-faible)]">
          {detail}
        </span>
      </Link>
    </li>
  );
}
