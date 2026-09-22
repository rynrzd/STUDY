import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { TitreEspace, Vide } from "@/components/app/Cadre";
import { FormulaireCompte } from "@/components/admin/Formulaires";
import { GestesCompte } from "@/components/admin/GestesCompte";
import { RechercheComptes } from "@/components/admin/RechercheComptes";
import { classes, contexte, membres } from "@/lib/etablissement";
import { sessionCourante } from "@/lib/session-serveur";

export const metadata: Metadata = { title: "Utilisateurs" };

/**
 * Utilisateurs de l'établissement — cahier V2 §14.3, cahier V5 §7.3 et §9.
 *
 * Tout l'état de l'écran est dans l'adresse : le filtre, la classe, la
 * recherche. « Les comptes à activer en Seconde 4 » est donc un lien qu'on
 * envoie à un collègue, et la page fonctionne sans JavaScript.
 *
 * Aucun mot de passe n'apparaît ici, même masqué. Ils n'existent que le temps
 * d'une création ou d'une réinitialisation, sur la fiche imprimable — et le
 * §7.3 interdit explicitement d'afficher « le mot de passe actuel », que le
 * produit serait de toute façon incapable de retrouver.
 */
export const dynamic = "force-dynamic";

const FILTRES = [
  { cle: "", libelle: "Tous" },
  { cle: "eleve", libelle: "Élèves" },
  { cle: "professeur", libelle: "Professeurs" },
  { cle: "a_activer", libelle: "À activer" },
] as const;

export default async function PageUtilisateurs({
  searchParams,
}: {
  searchParams: Promise<{ etat?: string; classe?: string; q?: string }>;
}) {
  const personne = await sessionCourante();
  if (personne === null) redirect("/connexion");

  const situation = await contexte(personne.profileId);
  if (situation === null) redirect("/admin");

  const [listeMembres, listeClasses] = await Promise.all([
    membres(personne.profileId),
    classes(personne.profileId),
  ]);

  const parametres = await searchParams;
  const filtre = parametres.etat ?? "";
  const classeChoisie = parametres.classe ?? "";
  const cherche = parametres.q ?? "";
  const recherche = cherche.trim().toLowerCase();

  const visibles = listeMembres.filter((membre) => {
    if (filtre === "eleve" && !membre.roles.includes("eleve")) return false;
    if (filtre === "professeur" && !membre.roles.includes("professeur")) return false;
    if (filtre === "a_activer" && membre.account_state !== "a_activer") return false;
    if (classeChoisie !== "" && membre.classe !== classeChoisie) return false;

    // La recherche porte sur ce qu'un secrétariat a sous les yeux : un nom
    // entendu au téléphone, ou un identifiant lu sur une fiche (§9).
    if (recherche === "") return true;
    return [membre.nom, membre.prenom, membre.local_login]
      .join(" ")
      .toLowerCase()
      .includes(recherche);
  });

  const optionsClasses = listeClasses.map((classe) => ({ id: classe.id, label: classe.label }));
  const classeExportee = listeClasses.find((classe) => classe.label === classeChoisie)?.id ?? null;
  const adresseExport =
    classeExportee === null ? "/admin/acces" : `/admin/acces?classe=${classeExportee}`;

  return (
    <>
      <TitreEspace
        titre="Utilisateurs"
        sousTitre={`${listeMembres.length} compte${listeMembres.length > 1 ? "s" : ""} dans ${
          situation.organisation
        }`}
      />

      <div className="mt-8">
        <FormulaireCompte listeClasses={optionsClasses} />
      </div>

      <section className="mt-11">
        <div className="flex flex-wrap items-baseline justify-between gap-3">
          <h2 className="text-[length:var(--text-h2-app)] leading-[var(--text-h2-app--line-height)]">
            Comptes
          </h2>
          <div className="flex flex-wrap items-center gap-4">
            <Link
              href="/admin/import"
              className="text-[length:var(--text-aide)] text-[color:var(--color-accent)]"
            >
              Import de rentrée
            </Link>
            {/* Un lien de téléchargement, dont l'adresse reste refusée à qui
                n'est pas administrateur de ce lycée. Le fichier ne contient
                aucun mot de passe : ils ne sont conservés nulle part. */}
            <a
              href={adresseExport}
              className="text-[length:var(--text-aide)] text-[color:var(--color-accent)]"
            >
              Exporter les accès (CSV)
            </a>
          </div>
        </div>

        <div className="mt-5">
          <RechercheComptes
            valeur={cherche}
            etat={filtre}
            classe={classeChoisie}
            classes={listeClasses.map((classe) => classe.label)}
          />
        </div>

        <nav aria-label="Filtrer les comptes" className="mt-4">
          <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
            {FILTRES.map((option) => {
              const active = option.cle === filtre;
              return (
                <li key={option.cle || "tous"}>
                  <Link
                    href={adresse(option.cle, classeChoisie, cherche)}
                    aria-current={active ? "page" : undefined}
                    aria-label={`N'afficher que : ${option.libelle}`}
                    className={`inline-flex min-h-9 items-center rounded-full border px-3.5 text-[length:var(--text-tableau)] no-underline ${
                      active
                        ? "border-[color:var(--color-accent)] bg-[color:var(--color-rose-clair)] font-semibold text-[color:var(--color-accent)]"
                        : "border-[color:var(--color-bordure)] bg-[color:var(--color-surface)] text-[color:var(--color-encre-faible)] hover:border-[color:var(--color-bordure-forte)]"
                    }`}
                  >
                    {option.libelle}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>

        {visibles.length === 0 ? (
          <div className="mt-6">
            <Vide
              titre="Aucun compte ne correspond."
              texte="Changez de filtre ou de recherche, ou créez un compte avec le formulaire ci-dessus. L'import de rentrée reste le chemin le plus rapide pour une classe entière."
            />
          </div>
        ) : (
          <div className="carte mt-5 overflow-x-auto">
            <table className="w-full min-w-[52rem] border-collapse text-[length:var(--text-tableau)]">
              <caption className="sr-only">Comptes de {situation.organisation}</caption>
              <thead>
                <tr className="border-b border-[color:var(--color-bordure-forte)] text-left">
                  <th scope="col" className="p-3 font-semibold">
                    Personne
                  </th>
                  <th scope="col" className="p-3 font-semibold">
                    Identifiant
                  </th>
                  <th scope="col" className="p-3 font-semibold">
                    Rôle
                  </th>
                  <th scope="col" className="p-3 font-semibold">
                    Classe
                  </th>
                  <th scope="col" className="p-3 font-semibold">
                    État
                  </th>
                  <th scope="col" className="p-3 font-semibold">
                    Accès
                  </th>
                </tr>
              </thead>
              <tbody>
                {visibles.slice(0, 500).map((membre) => (
                  <tr
                    key={membre.profile_id}
                    className="border-b border-[color:var(--color-bordure)] align-top last:border-b-0"
                  >
                    <td className="p-3">
                      <span className="font-medium">{membre.nom.toUpperCase()}</span>{" "}
                      {membre.prenom}
                    </td>
                    <td className="p-3 font-mono text-[color:var(--color-encre-faible)]">
                      {membre.local_login}
                    </td>
                    <td className="p-3 text-[color:var(--color-encre-faible)]">
                      {membre.roles.includes("professeur")
                        ? "Professeur"
                        : membre.roles.includes("admin_etablissement")
                          ? "Administration"
                          : "Élève"}
                    </td>
                    <td className="p-3 text-[color:var(--color-encre-faible)]">
                      {membre.classe ?? "—"}
                    </td>
                    <td className="p-3">
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
                            ? "À activer"
                            : membre.account_state}
                      </span>
                    </td>
                    <td className="p-3">
                      {membre.profile_id === personne.profileId ? (
                        <span className="text-[length:var(--text-aide)] text-[color:var(--color-encre-tres-faible)]">
                          Votre compte
                        </span>
                      ) : (
                        <GestesCompte
                          profil={membre.profile_id}
                          nom={membre.nom}
                          prenom={membre.prenom}
                          classe={membre.classe}
                          professeur={membre.roles.includes("professeur")}
                          actif={membre.account_state !== "suspendu"}
                          codeEtablissement={situation.publicCode}
                        />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {visibles.length > 500 ? (
          <p className="m-0 mt-3 text-[length:var(--text-aide)] text-[color:var(--color-encre-tres-faible)]">
            Les 500 premiers comptes sont affichés. Affinez avec la recherche ou
            un filtre pour voir les suivants.
          </p>
        ) : null}
      </section>
    </>
  );
}

/** L'adresse d'un filtre, en gardant la recherche et la classe en cours. */
function adresse(etat: string, classe: string, recherche: string): string {
  const parametres = new URLSearchParams();
  if (etat !== "") parametres.set("etat", etat);
  if (classe !== "") parametres.set("classe", classe);
  if (recherche !== "") parametres.set("q", recherche);

  const suite = parametres.toString();
  return suite === "" ? "/admin/utilisateurs" : `/admin/utilisateurs?${suite}`;
}
