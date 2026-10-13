import Link from "next/link";
import { Grid3x3, Search } from "lucide-react";
import { RubriqueClasses } from "@/components/study/Rubriques";
import { EnTetePage, EtatVide, ICONE } from "@/components/study/ui";
import { classeNormalisee } from "@/lib/assistant-rentree";
import type { Enseignement } from "@/lib/etablissement";
import { AideTrois } from "@/components/study/AideTrois";

export interface FiltresEnseignements {
  readonly niveau: "" | "2" | "1" | "t" | "groupes" | "autres";
  readonly professeur: string;
  readonly vacants: boolean;
}

const NIVEAUX = [
  ["2", "Seconde"],
  ["1", "Première"],
  ["t", "Terminale"],
  ["autres", "Autres classes"],
  ["groupes", "Groupes"],
] as const;

const ROLES: Record<string, string> = { titulaire: "", co_intervenant: "co-intervenant", remplacant: "remplaçant" };

function niveauDe(e: Pick<Enseignement, "genre" | "cible_label">): FiltresEnseignements["niveau"] {
  if (e.genre === "groupe") return "groupes";
  const n = classeNormalisee(e.cible_label).charAt(0);
  return n === "2" || n === "1" || n === "t" ? n : "autres";
}

const nomsDe = (e: Enseignement) => e.intervenants.map((i) => (ROLES[i.role] ? `${i.nom} (${ROLES[i.role]})` : i.nom));

/** Vue de la page, rendue avec des données réelles (page.tsx) ou fictives (aperçu de développement). */
export function VueEnseignements({ enseignements, filtres }: { enseignements: readonly Enseignement[] | null; filtres: FiltresEnseignements }) {
  const tous = enseignements ?? [];
  const professeurs = [...new Set(tous.flatMap((e) => e.intervenants.map((i) => i.nom)))].sort((a, b) => a.localeCompare(b, "fr"));
  const retenus = tous.filter(
    (e) =>
      (!filtres.niveau || niveauDe(e) === filtres.niveau) &&
      (!filtres.professeur || e.intervenants.some((i) => i.nom === filtres.professeur)) &&
      (!filtres.vacants || e.intervenants.length === 0),
  );
  const matieres = [...new Map(retenus.map((e) => [e.matiere, e.matiere_label])).entries()].sort((a, b) => a[1].localeCompare(b[1], "fr"));
  const cibles = [...new Map(retenus.map((e) => [e.cible, { label: e.cible_label, genre: e.genre }])).entries()].sort(
    (a, b) => (a[1].genre === b[1].genre ? a[1].label.localeCompare(b[1].label, "fr", { numeric: true }) : a[1].genre === "classe" ? -1 : 1),
  );
  const cellule = (cible: string, matiere: string) => retenus.find((e) => e.cible === cible && e.matiere === matiere);
  const vacants = tous.filter((e) => e.intervenants.length === 0).length;
  const filtre = filtres.niveau !== "" || filtres.professeur !== "" || filtres.vacants;

  return (
    <>
      <RubriqueClasses actif="/admin/enseignements" />
      <EnTetePage
        sourcil="Classes et groupes"
        titre="Qui enseigne quoi"
        actions={
          tous.length > 0 ? (
            <a href="/admin/enseignements/export" className="bouton bouton-secondaire" download>
              Exporter (CSV)
            </a>
          ) : null
        }
        sousTitre={`Chaque classe et chaque groupe, matière par matière, avec ses professeurs. ${tous.length} enseignement${tous.length > 1 ? "s" : ""}${vacants > 0 ? `, dont ${vacants} sans professeur` : ""}.`}
      />
      <AideTrois pourquoi="Voir d'un coup d'œil qui enseigne quoi, et repérer les cours sans professeur." quiVoit="Vous seul : cette vue est réservée à l'administration de l'établissement." apres="Cliquez une classe ou un groupe pour agir ; l'export CSV garde une trace dans le journal." />

      {enseignements === null ? (
        <p role="alert" className="m-0 text-[color:var(--color-erreur)]">
          La vue d&apos;ensemble n&apos;a pas pu être chargée. Le second facteur de votre session est-il validé ?
        </p>
      ) : tous.length === 0 ? (
        <EtatVide
          icone={Grid3x3}
          titre="Aucun enseignement pour l'instant."
          texte="Un enseignement naît quand on affecte un professeur à une classe ou à un groupe pour une matière."
          action={
            <Link href="/admin/classes#affecter" className="bouton bouton-primaire">
              Affecter un professeur
            </Link>
          }
        />
      ) : (
        <>
          <form method="get" action="/admin/enseignements" className="panneau mb-5 grid gap-3 md:grid-cols-[1fr_1fr_auto_auto] md:items-end" aria-label="Filtrer les enseignements">
            <div>
              <label className="etiquette" htmlFor="e-niveau">
                Niveau
              </label>
              <select id="e-niveau" name="niveau" defaultValue={filtres.niveau} className="champ">
                <option value="">Tous</option>
                {NIVEAUX.map(([v, l]) => (
                  <option key={v} value={v}>
                    {l}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="etiquette" htmlFor="e-prof">
                Professeur
              </label>
              <select id="e-prof" name="professeur" defaultValue={filtres.professeur} className="champ">
                <option value="">Tous</option>
                {professeurs.map((p) => (
                  <option key={p} value={p}>
                    {p}
                  </option>
                ))}
              </select>
            </div>
            <label className="flex min-h-[44px] items-center gap-2 text-[0.9375rem]">
              <input type="checkbox" name="vacants" value="oui" defaultChecked={filtres.vacants} className="size-4 accent-[color:var(--color-accent)]" />
              Sans professeur seulement
            </label>
            <div className="flex gap-2">
              <button type="submit" className="bouton bouton-secondaire bouton-compact">
                <Search {...ICONE} /> Filtrer
              </button>
              {filtre ? (
                <Link href="/admin/enseignements" className="bouton bouton-discret bouton-compact">
                  Tout
                </Link>
              ) : null}
            </div>
          </form>

          {retenus.length === 0 ? (
            <EtatVide icone={Search} titre="Rien ne correspond à ces filtres." texte="Retirez un filtre pour revoir tout l'établissement." />
          ) : (
            <>
              {/* Ordinateur : la grille. */}
              <div className="matrice-enseignements panneau p-0 md:p-0">
                <table>
                  <caption className="sr-only">Enseignements par classe ou groupe et par matière</caption>
                  <thead>
                    <tr>
                      <th scope="col">Classe ou groupe</th>
                      {matieres.map(([id, label]) => (
                        <th key={id} scope="col">
                          {label}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {cibles.map(([id, c]) => (
                      <tr key={id}>
                        <th scope="row">
                          <Link href={c.genre === "classe" ? `/admin/classes/${id}` : `/admin/groupes/${id}`}>{c.label}</Link>
                          {c.genre === "groupe" ? <span className="meta block">Groupe</span> : null}
                        </th>
                        {matieres.map(([m]) => {
                          const e = cellule(id, m);
                          return (
                            <td key={m}>
                              {e === undefined ? (
                                <span className="text-[color:var(--color-encre-tres-faible)]" aria-label="Pas d'enseignement">
                                  —
                                </span>
                              ) : e.intervenants.length === 0 ? (
                                <span className="puce-cours" data-ton="attention">
                                  Sans professeur
                                </span>
                              ) : (
                                nomsDe(e).join(", ")
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Téléphone : une carte par classe ou groupe, sans défilement horizontal. */}
              <ul className="matrice-mobile m-0 list-none space-y-3 p-0">
                {cibles.map(([id, c]) => (
                  <li key={id} className="panneau p-4">
                    <Link href={c.genre === "classe" ? `/admin/classes/${id}` : `/admin/groupes/${id}`} className="font-bold">
                      {c.label}
                    </Link>
                    <ul className="m-0 mt-2 list-none space-y-1.5 p-0">
                      {retenus
                        .filter((e) => e.cible === id)
                        .map((e) => (
                          <li key={e.espace} className="flex items-start justify-between gap-3 text-[0.9375rem]">
                            <span className="font-semibold">{e.matiere_label}</span>
                            {e.intervenants.length === 0 ? (
                              <span className="puce-cours" data-ton="attention">
                                Sans professeur
                              </span>
                            ) : (
                              <span className="text-right text-[color:var(--color-encre-faible)]">{nomsDe(e).join(", ")}</span>
                            )}
                          </li>
                        ))}
                    </ul>
                  </li>
                ))}
              </ul>
            </>
          )}
        </>
      )}
    </>
  );
}
