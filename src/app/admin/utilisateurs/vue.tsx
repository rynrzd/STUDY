import Link from "next/link";
import { Download, Search, Upload } from "lucide-react";
import { FormulaireCompte } from "@/components/admin/Formulaires";
import { GestesCompte } from "@/components/admin/GestesCompte";
import { RechercheComptes } from "@/components/admin/RechercheComptes";
import { EnTetePage, EtatVide, Etiquette, ICONE, OngletsLiens } from "@/components/study/ui";
import type { classes, contexte, membres } from "@/lib/etablissement";

const FILTRES = [
  { cle: "", libelle: "Tous" },
  { cle: "eleve", libelle: "Élèves" },
  { cle: "professeur", libelle: "Professeurs" },
  { cle: "a_activer", libelle: "À activer" },
] as const;

/** Vue de la page, rendue avec des données réelles (page.tsx) ou fictives (aperçu de développement). */
export function VueUtilisateurs({ situation, listeMembres, listeClasses, visibles, filtre, classeChoisie, cherche, adresseExport, optionsClasses, moi }: {
  situation: NonNullable<Awaited<ReturnType<typeof contexte>>>;
  listeMembres: Awaited<ReturnType<typeof membres>>;
  listeClasses: Awaited<ReturnType<typeof classes>>;
  visibles: Awaited<ReturnType<typeof membres>>;
  filtre: string;
  classeChoisie: string;
  cherche: string;
  adresseExport: string;
  optionsClasses: readonly { id: string; label: string }[];
  moi: string;
}) {
  const compte = (cle: string) =>
    listeMembres.filter((m) =>
      cle === "eleve" ? m.roles.includes("eleve") : cle === "professeur" ? m.roles.includes("professeur") : cle === "a_activer" ? m.account_state === "a_activer" : true,
    ).length;

  return (
    <>
      <EnTetePage
        sourcil="Administration"
        titre="Personnes"
        sousTitre={`${listeMembres.length} compte${listeMembres.length > 1 ? "s" : ""} dans ${situation.organisation}. Aucun mot de passe n'est affiché ici.`}
        actions={
          <>
            {/* Un lien de téléchargement, dont l'adresse reste refusée à qui
                n'est pas administrateur de ce lycée. Le fichier ne contient
                aucun mot de passe : ils ne sont conservés nulle part. */}
            <a href={adresseExport} className="bouton bouton-secondaire">
              <Download {...ICONE} /> Exporter les accès (CSV)
            </a>
            <Link href="/admin/import" className="bouton bouton-primaire">
              <Upload {...ICONE} /> Import de rentrée
            </Link>
          </>
        }
      />

      <OngletsLiens
        etiquette="Filtrer les comptes"
        onglets={FILTRES.map((option) => ({
          href: adresse(option.cle, classeChoisie, cherche),
          libelle: option.libelle,
          compte: compte(option.cle),
          actif: option.cle === filtre,
        }))}
      />

      <div className="mb-4">
        <RechercheComptes valeur={cherche} etat={filtre} classe={classeChoisie} classes={listeClasses.map((classe) => classe.label)} />
      </div>

      {visibles.length === 0 ? (
        <EtatVide
          icone={Search}
          titre="Aucun compte ne correspond."
          texte="Changez de filtre ou de recherche, ou créez un compte avec le formulaire ci-dessous. L'import de rentrée reste le chemin le plus rapide pour une classe entière."
        />
      ) : (
        <div className="overflow-x-auto rounded-[var(--radius-carte)] border border-[color:var(--color-bordure)] bg-[color:var(--color-surface)]">
          <table className="tableau-r2 min-w-[52rem]">
            <caption className="sr-only">Comptes de {situation.organisation}</caption>
            <thead>
              <tr>
                <th scope="col">Personne</th>
                <th scope="col">Identifiant</th>
                <th scope="col">Rôle</th>
                <th scope="col">Classe</th>
                <th scope="col">État</th>
                <th scope="col">Accès</th>
              </tr>
            </thead>
            <tbody>
              {visibles.slice(0, 500).map((membre) => (
                <tr key={membre.profile_id} className="align-top">
                  <td>
                    <span className="flex items-center gap-3">
                      <span className="avatar" aria-hidden="true">
                        {`${membre.prenom[0] ?? ""}${membre.nom[0] ?? ""}`.toUpperCase()}
                      </span>
                      <span>
                        <span className="font-semibold">{membre.nom.toUpperCase()}</span> {membre.prenom}
                      </span>
                    </span>
                  </td>
                  <td className="font-mono text-[color:var(--color-encre-faible)]">{membre.local_login}</td>
                  <td className="text-[color:var(--color-encre-faible)]">
                    {membre.roles.includes("professeur") ? "Professeur" : membre.roles.includes("admin_etablissement") ? "Administration" : "Élève"}
                  </td>
                  <td className="text-[color:var(--color-encre-faible)]">{membre.classe ?? "—"}</td>
                  <td>
                    <Etiquette ton={membre.account_state === "actif" ? "succes" : membre.account_state === "a_activer" ? "attention" : "neutre"}>
                      {membre.account_state === "actif" ? "Actif" : membre.account_state === "a_activer" ? "À activer" : membre.account_state}
                    </Etiquette>
                  </td>
                  <td>
                    {membre.profile_id === moi ? (
                      <span className="meta">Votre compte</span>
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

      {visibles.length > 500 ? <p className="meta m-0 mt-3">Les 500 premiers comptes sont affichés. Affinez avec la recherche ou un filtre pour voir les suivants.</p> : null}

      <div className="mt-8" id="creer">
        <FormulaireCompte listeClasses={optionsClasses} />
      </div>
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
