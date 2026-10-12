import { Check, School } from "lucide-react";
import { AjouterPersonne } from "@/components/admin/AjouterPersonne";
import { FormulaireAffectation, FormulaireClasse, FormulaireMatiere } from "@/components/admin/Formulaires";
import { EnTetePage, EtatVide } from "@/components/study/ui";
import type { affectations, classes } from "@/lib/etablissement";
import { RubriqueClasses } from "@/components/study/Rubriques";

type Classe = Awaited<ReturnType<typeof classes>>[number];
type Affectation = Awaited<ReturnType<typeof affectations>>[number];
type Option = { id: string; label: string };

/** Vue de la page, rendue avec des données réelles (page.tsx) ou fictives (aperçu de développement). */
export function VueClasses({
  listeClasses,
  listeAffectations,
  professeurs,
  matieres,
}: {
  listeClasses: readonly Classe[];
  listeAffectations: readonly Affectation[];
  professeurs: readonly Option[];
  matieres: readonly Option[];
}) {
  const optionsClasses = listeClasses.map((classe) => ({ id: classe.id, label: classe.label }));
  const sansProfesseur = listeAffectations.filter((lien) => lien.professeur_id === null).length;
  const ids = new Set(listeClasses.map((classe) => classe.id));
  const autres = listeAffectations.filter((lien) => !ids.has(lien.class_id));
  const etapes = [
    { titre: "Créer les classes", detail: `${listeClasses.length} classe${listeClasses.length > 1 ? "s" : ""}`, fait: listeClasses.length > 0 },
    { titre: "Créer les matières", detail: `${matieres.length} matière${matieres.length > 1 ? "s" : ""}`, fait: matieres.length > 0 },
    {
      titre: "Affecter les professeurs",
      detail: sansProfesseur > 0 ? `${sansProfesseur} cours sans professeur` : `${listeAffectations.length} cours ouvert${listeAffectations.length > 1 ? "s" : ""}`,
      fait: listeAffectations.length > 0 && sansProfesseur === 0,
    },
  ];

  return (
    <>
      <RubriqueClasses actif="/admin/classes" />
      <EnTetePage
        sourcil="Classes et groupes"
        titre="Classes et cours"
        sousTitre="Un cours s'ouvre en trois étapes : une classe, une matière, puis le professeur qui l'enseigne. Il apparaît alors dans « Mes cours » du professeur et chez les élèves."
        actions={<AjouterPersonne listeClasses={optionsClasses} libelle="Ajouter un élève ou un prof" variante="secondaire" />}
      />

      <ol className="parcours mb-8" aria-label="Étapes pour ouvrir un cours">
        {etapes.map((etape, i) => (
          <li key={etape.titre} data-fait={etape.fait ? "" : undefined}>
            <span className="parcours-numero" aria-hidden="true">
              {etape.fait ? <Check size={18} strokeWidth={2.5} /> : i + 1}
            </span>
            <span className="min-w-0">
              <span className="block font-bold">{etape.titre}</span>
              <span className="meta block">
                {etape.detail} · <span className="font-semibold">{etape.fait ? "fait" : "à faire"}</span>
              </span>
            </span>
          </li>
        ))}
      </ol>

      <div className="grid gap-4 lg:grid-cols-2">
        <FormulaireClasse />
        <FormulaireMatiere />
      </div>

      <div className="mt-4 scroll-mt-24" id="affecter">
        <FormulaireAffectation professeurs={professeurs} listeClasses={optionsClasses} matieres={matieres} />
      </div>

      <section className="mt-10" aria-labelledby="cours">
        <h2 id="cours" className="titre-section mb-3 flex items-center gap-2">
          Classes de l&apos;établissement <span className="nombre">{listeClasses.length}</span>
        </h2>
        {listeClasses.length === 0 ? (
          <EtatVide icone={School} titre="Aucune classe pour l'instant." texte="Créez la première avec le formulaire ci-dessus, ou importez vos élèves : l'import crée les classes à partir du fichier." />
        ) : (
          <ul className="m-0 grid list-none gap-3 p-0 sm:grid-cols-2 xl:grid-cols-3">
            {listeClasses.map((classe) => {
              const cours = listeAffectations.filter((lien) => lien.class_id === classe.id);
              return (
                <li key={classe.id} className="panneau flex flex-col gap-3">
                  <div className="flex items-center gap-3">
                    <span className="tuile" aria-hidden="true">
                      <School size={20} strokeWidth={1.75} />
                    </span>
                    <span className="min-w-0">
                      <span className="block font-bold">{classe.label}</span>
                      <span className="meta block">
                        {classe.effectif} élève{classe.effectif > 1 ? "s" : ""} · {cours.length} cours
                      </span>
                    </span>
                  </div>
                  {cours.length === 0 ? (
                    <p className="meta m-0">Aucun cours : affectez un professeur pour en ouvrir un.</p>
                  ) : (
                    <ul className="m-0 flex list-none flex-col gap-1.5 p-0">
                      {cours.map((lien) => (
                        <li key={`${lien.teaching_space_id}-${lien.professeur_id ?? "vacant"}`} className="flex items-center justify-between gap-3 text-[0.9375rem]">
                          <span className="font-semibold">{lien.matiere}</span>
                          {lien.professeur_id === null ? (
                            <span className="puce-cours" data-ton="attention">
                              Sans professeur
                            </span>
                          ) : (
                            <span className="truncate text-[color:var(--color-encre-faible)]">
                              {lien.prenom} {lien.nom}
                            </span>
                          )}
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              );
            })}
          </ul>
        )}
        {autres.length > 0 ? (
          <div className="panneau mt-3">
            <p className="m-0 font-bold">Autres cours</p>
            <p className="meta m-0 mt-1">Rattachés à une classe d&apos;une autre année ou archivée.</p>
            <ul className="m-0 mt-3 flex list-none flex-wrap gap-2 p-0">
              {autres.map((lien) => (
                <li key={`${lien.teaching_space_id}-${lien.professeur_id ?? "vacant"}`} className="puce-cours" data-ton={lien.professeur_id === null ? "attention" : undefined}>
                  <span className="font-semibold">{lien.classe}</span> {lien.matiere}
                  {lien.professeur_id === null ? " · sans professeur" : ` · ${lien.prenom} ${lien.nom}`}
                </li>
              ))}
            </ul>
          </div>
        ) : null}
      </section>
    </>
  );
}
