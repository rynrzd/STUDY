import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { TitreEspace, Vide } from "@/components/app/Cadre";
import { affectations, contexte, membres } from "@/lib/etablissement";
import { sessionCourante } from "@/lib/session-serveur";

export const metadata: Metadata = { title: "Professeurs" };

/**
 * Les professeurs et ce qu'ils enseignent — cahier V5, §9.
 *
 * L'écran répond à la question que pose un proviseur en septembre : qui
 * enseigne quoi, et à qui ? Chaque ligne montre les affectations réelles —
 * celles qui ouvrent un Studio — et non une matière déclarée. « Professeur de
 * mathématiques » ne dit rien de ce qui est accessible ; « Mathématiques en
 * 2DE1 et 2DE2 » le dit exactement.
 *
 * Un professeur sans affectation est signalé : son compte existe, mais il ne
 * voit aucune classe et ne peut rien publier. C'est l'erreur de rentrée la
 * plus fréquente, et la plus silencieuse.
 */
export const dynamic = "force-dynamic";

export default async function PageProfesseurs({
  searchParams,
}: {
  searchParams: Promise<{ q?: string }>;
}) {
  const personne = await sessionCourante();
  if (personne === null) redirect("/connexion");

  const situation = await contexte(personne.profileId);
  if (situation === null) redirect("/admin");

  const [listeMembres, listeAffectations] = await Promise.all([
    membres(personne.profileId),
    affectations(personne.profileId),
  ]);

  const parametres = await searchParams;
  const cherche = (parametres.q ?? "").trim();
  const recherche = cherche.toLowerCase();

  const parProfesseur = new Map<string, { matiere: string; classe: string }[]>();
  for (const lien of listeAffectations) {
    if (lien.professeur_id === null) continue;
    parProfesseur.set(lien.professeur_id, [
      ...(parProfesseur.get(lien.professeur_id) ?? []),
      { matiere: lien.matiere, classe: lien.classe },
    ]);
  }

  const enseignants = listeMembres
    .filter((membre) => membre.roles.includes("professeur"))
    .filter((membre) => {
      if (recherche === "") return true;
      return `${membre.nom} ${membre.prenom} ${membre.local_login}`
        .toLowerCase()
        .includes(recherche);
    });

  const sansAffectation = enseignants.filter(
    (membre) => (parProfesseur.get(membre.profile_id) ?? []).length === 0,
  );
  const coursSansProfesseur = listeAffectations.filter((lien) => lien.professeur_id === null);

  return (
    <>
      <TitreEspace
        titre="Professeurs"
        sousTitre={`${enseignants.length} compte${
          enseignants.length > 1 ? "s" : ""
        } dans ${situation.organisation}`}
        action={
          <Link href="/admin/import" className="bouton bouton-secondaire">
            Importer des professeurs
          </Link>
        }
      />

      {sansAffectation.length > 0 || coursSansProfesseur.length > 0 ? (
        <section aria-labelledby="titre-attention" className="mt-8">
          <h2
            id="titre-attention"
            className="text-[length:var(--text-h2-app)] leading-[var(--text-h2-app--line-height)]"
          >
            À traiter
          </h2>
          <ul className="m-0 mt-3 list-none space-y-2 p-0 text-[length:var(--text-tableau)]">
            {sansAffectation.length > 0 ? (
              <li className="rounded-[var(--radius-champ)] border border-[color:var(--color-bordure)] p-4">
                <p className="m-0 font-medium">
                  {sansAffectation.length} professeur
                  {sansAffectation.length > 1 ? "s" : ""} sans aucune affectation
                </p>
                <p className="m-0 mt-1 max-w-[var(--spacing-lecture)] text-[length:var(--text-aide)] leading-[var(--text-aide--line-height)] text-[color:var(--color-encre-faible)]">
                  Leur compte existe, mais ils ne voient aucune classe et ne
                  peuvent rien publier. Affectez-les depuis « Classes », ou
                  réimportez un fichier de professeurs.
                </p>
              </li>
            ) : null}
            {coursSansProfesseur.length > 0 ? (
              <li className="rounded-[var(--radius-champ)] border border-[color:var(--color-bordure)] p-4">
                <p className="m-0 font-medium">
                  {coursSansProfesseur.length} cours sans professeur
                </p>
                <p className="m-0 mt-1 text-[length:var(--text-aide)] text-[color:var(--color-encre-faible)]">
                  {coursSansProfesseur
                    .slice(0, 6)
                    .map((lien) => `${lien.matiere} — ${lien.classe}`)
                    .join(" · ")}
                  {coursSansProfesseur.length > 6 ? " …" : ""}
                </p>
              </li>
            ) : null}
          </ul>
        </section>
      ) : null}

      <section className="mt-10">
        <form action="/admin/professeurs" method="get" className="flex flex-wrap items-end gap-3">
          <div className="min-w-[12rem] flex-1">
            <label className="etiquette" htmlFor="recherche-profs">
              Rechercher
            </label>
            <input
              id="recherche-profs"
              name="q"
              type="search"
              defaultValue={cherche}
              placeholder="Nom, prénom ou identifiant"
              className="champ"
            />
          </div>
          <button type="submit" className="bouton bouton-secondaire">
            Filtrer
          </button>
        </form>

        {enseignants.length === 0 ? (
          <div className="mt-6">
            <Vide
              titre="Aucun professeur ne correspond."
              texte="Les comptes professeurs se créent un par un depuis « Utilisateurs », ou en une fois depuis l'import de rentrée."
            />
          </div>
        ) : (
          <ul className="m-0 mt-6 grid list-none gap-3 p-0 lg:grid-cols-2">
            {enseignants.map((membre) => {
              const siennes = parProfesseur.get(membre.profile_id) ?? [];
              const matieres = [...new Set(siennes.map((lien) => lien.matiere))];

              return (
                <li key={membre.profile_id} className="carte p-5">
                  <div className="flex flex-wrap items-baseline justify-between gap-2">
                    <p className="m-0 font-semibold">
                      {membre.nom.toUpperCase()} {membre.prenom}
                    </p>
                    <span
                      className={`pastille ${
                        membre.account_state === "actif"
                          ? "pastille-publie"
                          : membre.account_state === "a_activer"
                            ? "pastille-attention"
                            : "pastille-brouillon"
                      }`}
                    >
                      {membre.account_state === "actif"
                        ? "Actif"
                        : membre.account_state === "a_activer"
                          ? "Jamais connecté"
                          : membre.account_state}
                    </span>
                  </div>

                  <p className="m-0 mt-1 font-mono text-[length:var(--text-aide)] text-[color:var(--color-encre-faible)]">
                    {membre.local_login}
                  </p>

                  {siennes.length === 0 ? (
                    <p className="m-0 mt-3 text-[length:var(--text-aide)] text-[color:var(--color-erreur)]">
                      Aucune affectation : ce compte ne voit aucune classe.
                    </p>
                  ) : (
                    <>
                      <p className="m-0 mt-3 text-[length:var(--text-aide)] text-[color:var(--color-encre-faible)]">
                        {matieres.join(" · ")}
                      </p>
                      <ul className="m-0 mt-2 flex list-none flex-wrap gap-2 p-0">
                        {siennes.map((lien) => (
                          <li
                            key={`${lien.matiere}-${lien.classe}`}
                            className="rounded-full border border-[color:var(--color-bordure)] px-2.5 py-1 text-[length:var(--text-aide)]"
                          >
                            {lien.classe}
                            <span className="text-[color:var(--color-encre-tres-faible)]">
                              {" "}
                              · {lien.matiere}
                            </span>
                          </li>
                        ))}
                      </ul>
                    </>
                  )}

                  <p className="m-0 mt-4 text-[length:var(--text-aide)]">
                    <Link
                      href={`/admin/utilisateurs?etat=professeur&q=${encodeURIComponent(
                        membre.local_login,
                      )}`}
                      className="text-[color:var(--color-accent)]"
                    >
                      Gérer l&apos;accès
                    </Link>
                  </p>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </>
  );
}
