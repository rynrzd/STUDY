import Link from "next/link";
import { BookOpen, GraduationCap, Layers, Users } from "lucide-react";
import { AjouterPersonne } from "@/components/admin/AjouterPersonne";
import { ProfesseurPrincipal } from "@/components/admin/ProfesseurPrincipal";
import { ElevesClasse } from "@/components/admin/GroupeFormulaires";
import { CarteChiffre, EnTetePage, EtatVide, Etiquette, ICONE, Ligne, ListeLignes } from "@/components/study/ui";
import type { FicheClasse } from "@/lib/etablissement";

const ETATS: Record<string, { texte: string; ton: "succes" | "attention" | "erreur" | "neutre" }> = {
  actif: { texte: "Actif", ton: "succes" },
  a_activer: { texte: "Jamais connecté", ton: "attention" },
  suspendu: { texte: "Suspendu", ton: "erreur" },
  sorti: { texte: "Sorti", ton: "neutre" },
};

/** Vue de la page, rendue avec des données réelles (page.tsx) ou fictives (aperçu de développement). */
export function VueFicheClasse({
  fiche,
  professeurs,
  groupesEtab = [],
  effectifA = null,
}: {
  fiche: FicheClasse;
  professeurs: readonly { id: string; label: string }[];
  /** Groupes de l'établissement, pour y ajouter des élèves cochés (EL-06). */
  groupesEtab?: readonly { id: string; label: string }[];
  /** Effectif à une date choisie (CL-09). */
  effectifA?: { date: string; n: number | null } | null;
}) {
  const { classe, eleves, cours, groupes } = fiche;
  const sansProf = cours.filter((c) => !c.professeurs).length;
  return (
    <>
      <EnTetePage
        filAriane={[
          { href: "/admin/classes", libelle: "Classes et groupes" },
          { href: `/admin/classes/${classe.id}`, libelle: classe.label },
        ]}
        sourcil={`Fiche classe · ${classe.annee}${classe.archivee ? " · Année archivée" : ""}`}
        titre={classe.label}
        actions={
          classe.archivee ? null : (
            <>
              <Link href="/admin/classes#affecter" className="bouton bouton-secondaire">
                <GraduationCap {...ICONE} /> Affecter un cours
              </Link>
              <AjouterPersonne listeClasses={[{ id: classe.id, label: classe.label }]} libelle="Ajouter un élève" />
            </>
          )
        }
      />

      {classe.archivee ? null : (
        <div className="mb-6 max-w-[560px]">
          <ProfesseurPrincipal classe={classe.id} libelleClasse={classe.label} actuel={fiche.professeur_principal} professeurs={professeurs} />
        </div>
      )}

      <section aria-label="Chiffres de la classe" className="grid gap-3 sm:grid-cols-3">
        <CarteChiffre icone={Users} libelle="Élèves" valeur={eleves.length} detail={`${eleves.filter((e) => e.etat_compte === "a_activer").length} jamais connecté(s)`} />
        <CarteChiffre icone={BookOpen} libelle="Cours" valeur={cours.length} detail={sansProf > 0 ? `${sansProf} sans professeur` : "Tous ont un professeur"} />
        <CarteChiffre icone={Layers} libelle="Groupes" valeur={groupes.length} detail="Où vont ses élèves" />
      </section>

      <div className="mt-8 grid gap-8 lg:grid-cols-[minmax(0,1fr)_minmax(0,1fr)]">
        <section aria-labelledby="eleves">
          <h2 id="eleves" className="titre-section mb-3 flex items-center gap-2">
            Élèves <span className="nombre">{eleves.length}</span>
          </h2>
          {eleves.length === 0 ? (
            <EtatVide icone={Users} titre="Aucun élève dans cette classe." texte="Ajoutez-en un avec le bouton en haut, ou importez la liste depuis « Personnes »." />
          ) : (
            <div className="panneau p-3 md:p-4">
              <ElevesClasse
                classe={classe.id}
                eleves={eleves}
                groupes={groupesEtab}
                contenus={Object.fromEntries(
                  eleves.map((e) => {
                    const etat = ETATS[e.etat_compte] ?? { texte: e.etat_compte, ton: "neutre" as const };
                    return [
                      e.id,
                      <Link key={e.id} href={`/admin/eleves/${e.id}`} className="flex min-h-[48px] items-center justify-between gap-3 border-b border-[color:var(--color-bordure)] py-2 text-[color:var(--color-encre)] no-underline hover:text-[color:var(--color-accent)]">
                        <span className="min-w-0">
                          <span className="block font-semibold">
                            {e.nom} {e.prenom}
                          </span>
                          <span className="meta block">{e.identifiant}</span>
                        </span>
                        {etat.ton === "succes" ? null : <Etiquette ton={etat.ton}>{etat.texte}</Etiquette>}
                      </Link>,
                    ];
                  }),
                )}
              />
            </div>
          )}
          <p className="meta m-0 mt-2">Pour changer un élève de classe, ouvrez sa fiche.</p>
          <form method="get" className="mt-4 flex flex-wrap items-end gap-2">
            <div>
              <label className="etiquette" htmlFor="effectif-date">
                Effectif à une date
              </label>
              <input id="effectif-date" name="date" type="date" defaultValue={effectifA?.date ?? ""} className="champ" />
            </div>
            <button type="submit" className="bouton bouton-compact bouton-secondaire">
              Voir
            </button>
            {effectifA ? (
              <span className="meta" role="status">
                {effectifA.n === null ? "Indisponible." : `${effectifA.n} élève${effectifA.n > 1 ? "s" : ""} inscrit${effectifA.n > 1 ? "s" : ""} le ${new Date(effectifA.date).toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" })}.`}
              </span>
            ) : null}
          </form>
        </section>

        <div className="space-y-8">
          <section aria-labelledby="cours">
            <h2 id="cours" className="titre-section mb-3">
              Cours
            </h2>
            {cours.length === 0 ? (
              <p className="meta m-0">Aucun cours : affectez un professeur pour en ouvrir un.</p>
            ) : (
              <ListeLignes>
                {cours.map((c) => (
                  <Ligne
                    key={c.espace}
                    icone={BookOpen}
                    titre={c.matiere}
                    detail={c.professeurs ?? "Personne ne peut y publier pour l'instant."}
                    fin={c.professeurs ? null : <Etiquette ton="attention">Sans professeur</Etiquette>}
                  />
                ))}
              </ListeLignes>
            )}
          </section>

          <section aria-labelledby="groupes">
            <h2 id="groupes" className="titre-section mb-3">
              Groupes de ses élèves
            </h2>
            {groupes.length === 0 ? (
              <p className="meta m-0">Aucun élève de cette classe n&apos;est dans un groupe.</p>
            ) : (
              <ListeLignes>
                {groupes.map((g) => (
                  <Ligne
                    key={g.id}
                    href={`/admin/groupes/${g.id}`}
                    icone={Layers}
                    titre={g.label}
                    detail={`${g.kind === "interclasses" ? "Interclasses" : "Demi-groupe"} · ${g.eleves_de_la_classe} élève${g.eleves_de_la_classe > 1 ? "s" : ""} de la classe`}
                  />
                ))}
              </ListeLignes>
            )}
          </section>
        </div>
      </div>
    </>
  );
}
