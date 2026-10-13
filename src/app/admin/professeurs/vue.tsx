import Link from "next/link";
import { ArrowRight, BookOpen, Presentation, Search, Upload, Users, UserX } from "lucide-react";
import { AffecterPlusieurs } from "@/components/admin/AffecterPlusieurs";
import { AjouterPersonne } from "@/components/admin/AjouterPersonne";
import { TerminerAffectation } from "@/components/admin/TerminerAffectation";
import { EnTetePage, EtatVide, Etiquette, ICONE } from "@/components/study/ui";
import type { affectations, contexte, membres } from "@/lib/etablissement";
import { RubriquePersonnes } from "@/components/study/Rubriques";

type Membre = Awaited<ReturnType<typeof membres>>[number];
type Affectation = Awaited<ReturnType<typeof affectations>>[number];

/** Un cours d'un professeur, avec son rôle et ses dates. */
export interface LigneCours {
  readonly affectation: string;
  readonly matiere: string;
  readonly cible: string;
  readonly genre: "classe" | "groupe";
  readonly role: "titulaire" | "remplacant" | "co_intervenant";
  readonly debut: string;
  readonly fin: string | null;
  /** Commence après aujourd'hui. */
  readonly aVenir: boolean;
}

const ROLES: Record<LigneCours["role"], string> = { titulaire: "", remplacant: "Remplaçant", co_intervenant: "Co-intervenant" };
const jourLisible = (iso: string) => new Date(`${iso}T12:00:00`).toLocaleDateString("fr-FR", { day: "numeric", month: "short" });

/** Vue de la page, rendue avec des données réelles (page.tsx) ou fictives (aperçu de développement). */
export function VueProfesseurs({
  situation,
  enseignants,
  total,
  parProfesseur,
  titulairesMultiples = [],
  coursSansProfesseur,
  cherche,
  filtres = { matiere: "", cible: "", role: "", etat: "" },
  optionsFiltres = { matieres: [], cibles: [] },
  optionsClasses,
  optionsGroupes = [],
  optionsMatieres = [],
}: {
  situation: NonNullable<Awaited<ReturnType<typeof contexte>>>;
  /** Les professeurs affichés (après recherche). */
  enseignants: readonly Membre[];
  /** Tous les professeurs de l'établissement. */
  total: number;
  parProfesseur: ReadonlyMap<string, readonly LigneCours[]>;
  /** Cours où plusieurs professeurs sont titulaires en même temps (PROF-16). */
  titulairesMultiples?: readonly { cours: string; noms: string }[];
  coursSansProfesseur: readonly Affectation[];
  cherche: string;
  /** Filtres PROF-15 : matière, classe ou groupe, rôle, état du compte. */
  filtres?: { matiere: string; cible: string; role: string; etat: string };
  optionsFiltres?: { matieres: readonly string[]; cibles: readonly string[] };
  optionsClasses: readonly { id: string; label: string }[];
  optionsGroupes?: readonly { id: string; label: string }[];
  optionsMatieres?: readonly { id: string; label: string }[];
}) {
  const sansAffectation = enseignants.filter((membre) => (parProfesseur.get(membre.profile_id) ?? []).length === 0);
  const nbCours = [...parProfesseur.values()].reduce((n, liens) => n + liens.length, 0);

  return (
    <>
      <RubriquePersonnes actif="/admin/professeurs" />
      <EnTetePage
        sourcil="Personnes"
        titre="Professeurs et cours"
        sousTitre={`${total} professeur${total > 1 ? "s" : ""} · ${nbCours} cours affecté${nbCours > 1 ? "s" : ""} dans ${situation.organisation}.`}
        actions={
          <>
            <AjouterPersonne listeClasses={optionsClasses} roleInitial="professeur" libelle="Ajouter un professeur" />
          </>
        }
      />

      {sansAffectation.length > 0 || coursSansProfesseur.length > 0 || titulairesMultiples.length > 0 ? (
        <section aria-labelledby="a-traiter" className="mb-8">
          <h2 id="a-traiter" className="titre-section mb-3">
            À traiter
          </h2>
          <div className="grid gap-3 lg:grid-cols-2">
            {sansAffectation.length > 0 ? (
              <div className="panneau flex flex-col gap-3">
                <div className="flex items-start gap-3">
                  <span className="tuile" data-ton="neutre" aria-hidden="true">
                    <UserX size={20} strokeWidth={1.75} />
                  </span>
                  <div className="min-w-0">
                    <p className="m-0 font-bold">
                      {sansAffectation.length} professeur{sansAffectation.length > 1 ? "s" : ""} sans classe
                    </p>
                    <p className="meta m-0 mt-1">Le compte existe, mais il ne voit aucune classe et ne peut rien publier.</p>
                  </div>
                </div>
                <p className="m-0 flex flex-wrap gap-2">
                  {sansAffectation.slice(0, 6).map((membre) => (
                    <span key={membre.profile_id} className="puce-cours" data-ton="attention">
                      {membre.prenom} {membre.nom}
                    </span>
                  ))}
                  {sansAffectation.length > 6 ? <span className="puce-cours">+{sansAffectation.length - 6}</span> : null}
                </p>
                <Link href="/admin/classes#affecter" className="bouton bouton-primaire self-start">
                  Affecter à une classe <ArrowRight {...ICONE} />
                </Link>
              </div>
            ) : null}
            {coursSansProfesseur.length > 0 ? (
              <div className="panneau flex flex-col gap-3">
                <div className="flex items-start gap-3">
                  <span className="tuile" data-ton="neutre" aria-hidden="true">
                    <BookOpen size={20} strokeWidth={1.75} />
                  </span>
                  <div className="min-w-0">
                    <p className="m-0 font-bold">
                      {coursSansProfesseur.length} cours sans professeur
                    </p>
                    <p className="meta m-0 mt-1">Personne ne peut y publier de séance tant qu&apos;un professeur n&apos;y est pas affecté.</p>
                  </div>
                </div>
                <p className="m-0 flex flex-wrap gap-2">
                  {coursSansProfesseur.slice(0, 6).map((lien) => (
                    <span key={lien.teaching_space_id} className="puce-cours" data-ton="attention">
                      {lien.matiere} · {lien.classe}
                    </span>
                  ))}
                  {coursSansProfesseur.length > 6 ? <span className="puce-cours">+{coursSansProfesseur.length - 6}</span> : null}
                </p>
                <Link href="/admin/classes#affecter" className="bouton bouton-secondaire self-start">
                  Choisir un professeur <ArrowRight {...ICONE} />
                </Link>
              </div>
            ) : null}
            {titulairesMultiples.length > 0 ? (
              <div className="panneau flex flex-col gap-3">
                <div className="flex items-start gap-3">
                  <span className="tuile" data-ton="neutre" aria-hidden="true">
                    <Users size={20} strokeWidth={1.75} />
                  </span>
                  <div className="min-w-0">
                    <p className="m-0 font-bold">
                      {titulairesMultiples.length} cours avec plusieurs titulaires
                    </p>
                    <p className="meta m-0 mt-1">Si c&apos;est voulu, passez l&apos;un d&apos;eux en co-intervenant ; sinon, terminez l&apos;affectation en trop. Rien n&apos;est retiré automatiquement.</p>
                  </div>
                </div>
                <ul className="m-0 list-none space-y-1 p-0 text-[0.875rem]">
                  {titulairesMultiples.slice(0, 6).map((t) => (
                    <li key={t.cours}>
                      <span className="font-semibold">{t.cours}</span> <span className="meta">— {t.noms}</span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}
          </div>
        </section>
      ) : null}

      {total === 0 ? (
        <EtatVide
          icone={Presentation}
          titre="Aucun professeur pour l'instant."
          texte="Ajoutez un professeur en quelques secondes, ou importez la liste de toute l'équipe depuis un fichier."
          action={
            <>
              <AjouterPersonne listeClasses={optionsClasses} roleInitial="professeur" libelle="Ajouter un professeur" />
              <Link href="/admin/import" className="bouton bouton-secondaire">
                <Upload {...ICONE} /> Importer un fichier
              </Link>
            </>
          }
        />
      ) : (
        <section aria-labelledby="equipe">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
            <h2 id="equipe" className="titre-section flex items-center gap-2">
              L&apos;équipe <span className="nombre">{enseignants.length}</span>
            </h2>
            <form action="/admin/professeurs" method="get" role="search" className="grid w-full gap-2 sm:grid-cols-2 lg:grid-cols-[minmax(0,2fr)_repeat(4,minmax(0,1fr))_auto] lg:items-end">
              <label htmlFor="recherche-profs" className="sr-only">
                Rechercher un professeur
              </label>
              <span className="relative min-w-0">
                <Search size={18} strokeWidth={1.75} aria-hidden="true" className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-[color:var(--color-encre-faible)]" />
                <input id="recherche-profs" name="q" type="search" defaultValue={cherche} placeholder="Nom, prénom ou identifiant" className="champ pl-10" />
              </span>
              <select name="matiere" defaultValue={filtres.matiere} className="champ" aria-label="Matière">
                <option value="">Toutes les matières</option>
                {optionsFiltres.matieres.map((m) => (
                  <option key={m}>{m}</option>
                ))}
              </select>
              <select name="cible" defaultValue={filtres.cible} className="champ" aria-label="Classe ou groupe">
                <option value="">Toutes les classes et groupes</option>
                {optionsFiltres.cibles.map((m) => (
                  <option key={m}>{m}</option>
                ))}
              </select>
              <select name="role" defaultValue={filtres.role} className="champ" aria-label="Rôle">
                <option value="">Tous les rôles</option>
                <option value="titulaire">Titulaire</option>
                <option value="co_intervenant">Co-intervenant</option>
                <option value="remplacant">Remplaçant</option>
              </select>
              <select name="etat" defaultValue={filtres.etat} className="champ" aria-label="État du compte">
                <option value="">Tous les comptes</option>
                <option value="actif">Actifs</option>
                <option value="a_activer">Jamais connectés</option>
                <option value="suspendu">Suspendus</option>
              </select>
              <button type="submit" className="bouton bouton-secondaire">
                Rechercher
              </button>
            </form>
          </div>

          {enseignants.length === 0 ? (
            <EtatVide
              icone={Search}
              titre="Aucun professeur ne correspond."
              texte="Vérifiez l'orthographe, ou cherchez par identifiant."
              action={
                <Link href="/admin/professeurs" className="bouton bouton-secondaire">
                  Voir toute l&apos;équipe
                </Link>
              }
            />
          ) : (
            <ul className="m-0 grid list-none gap-3 p-0 lg:grid-cols-2">
              {enseignants.map((membre) => {
                const siennes = parProfesseur.get(membre.profile_id) ?? [];
                return (
                  <li key={membre.profile_id} className="panneau flex flex-col gap-4">
                    <div className="flex items-start gap-3">
                      <span className="avatar" aria-hidden="true">
                        {`${membre.prenom[0] ?? ""}${membre.nom[0] ?? ""}`.toUpperCase()}
                      </span>
                      <div className="min-w-0 flex-1">
                        <p className="m-0 font-bold">
                          <Link href={`/admin/professeurs/${membre.profile_id}`} className="text-[color:var(--color-encre)] hover:text-[color:var(--color-accent)]">
                            {membre.prenom} {membre.nom}
                          </Link>
                        </p>
                        <p className="m-0 font-mono text-[0.8125rem] text-[color:var(--color-encre-faible)]">{membre.local_login}</p>
                      </div>
                      <Etiquette ton={membre.account_state === "actif" ? "succes" : membre.account_state === "a_activer" ? "attention" : "neutre"}>
                        {membre.account_state === "actif" ? "Actif" : membre.account_state === "a_activer" ? "Jamais connecté" : membre.account_state}
                      </Etiquette>
                    </div>

                    {siennes.length === 0 ? (
                      <p className="m-0 flex flex-wrap items-center gap-2 text-[0.875rem] text-[color:var(--color-attention)]">
                        <span className="puce-cours" data-ton="attention">
                          Aucune classe
                        </span>
                        Ce compte ne voit encore aucun cours.
                      </p>
                    ) : (
                      <ul className="m-0 list-none space-y-1.5 p-0" aria-label={`Cours de ${membre.prenom} ${membre.nom}`}>
                        {siennes.map((lien) => (
                          <li key={lien.affectation} className="ligne-cours-prof">
                            <span className="min-w-0">
                              <span className="font-semibold">{lien.cible}</span> <span className="text-[color:var(--color-encre-faible)]">{lien.matiere}</span>
                              {lien.genre === "groupe" ? <span className="meta"> · groupe</span> : null}
                              {ROLES[lien.role] !== "" || lien.fin !== null || lien.aVenir ? (
                                <span className="mt-0.5 flex flex-wrap gap-1.5">
                                  {ROLES[lien.role] !== "" ? <span className="puce-cours py-0.5 text-[0.75rem]">{ROLES[lien.role]}</span> : null}
                                  {lien.aVenir ? <span className="puce-cours py-0.5 text-[0.75rem]">dès le {jourLisible(lien.debut)}</span> : null}
                                  {lien.fin !== null ? <span className="puce-cours py-0.5 text-[0.75rem]" data-ton={lien.role === "remplacant" ? "attention" : undefined}>jusqu&apos;au {jourLisible(lien.fin)}</span> : null}
                                </span>
                              ) : null}
                            </span>
                            <TerminerAffectation affectation={lien.affectation} libelle={`${lien.matiere} — ${lien.cible}`} />
                          </li>
                        ))}
                      </ul>
                    )}

                    <div className="mt-auto flex flex-wrap gap-2 border-t border-[color:var(--bordure-douce,var(--color-bordure))] pt-3">
                      <AffecterPlusieurs
                        existantes={siennes.map((s) => `${s.cible}|${s.matiere}`)}
                        professeur={membre.profile_id}
                        nom={`${membre.prenom} ${membre.nom}`}
                        classes={optionsClasses}
                        groupes={optionsGroupes}
                        matieres={optionsMatieres}
                        libelle={siennes.length === 0 ? "Affecter à des cours" : "Ajouter des cours"}
                        variante={siennes.length === 0 ? "primaire" : "secondaire"}
                      />
                      <Link href={`/admin/utilisateurs?etat=professeur&q=${encodeURIComponent(membre.local_login)}`} className="bouton bouton-compact bouton-discret">
                        Gérer l&apos;accès
                      </Link>
                    </div>
                  </li>
                );
              })}
            </ul>
          )}
        </section>
      )}
    </>
  );
}
