import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { TitreEspace } from "@/components/app/Cadre";
import {
  FormulaireAffectation,
  FormulaireClasse,
  FormulaireMatiere,
} from "@/components/admin/Formulaires";
import { affectations, classes, contexte, matieres, membres } from "@/lib/etablissement";
import { sessionCourante } from "@/lib/session-serveur";

export const metadata: Metadata = { title: "Classes" };

/**
 * Classes, matières et affectations — cahier V2, §14.2.
 *
 * Les trois vivent sur le même écran parce qu'elles n'ont de sens qu'ensemble :
 * une classe sans matière ni professeur ne produit aucun cours, et l'ordre des
 * gestes (créer la classe, créer la matière, affecter) se lit de haut en bas.
 */
export const dynamic = "force-dynamic";

export default async function PageAdminClasses() {
  const personne = await sessionCourante();
  if (personne === null) redirect("/connexion");

  const situation = await contexte(personne.profileId);
  if (situation === null) redirect("/admin");

  const [listeClasses, listeMatieres, listeMembres, listeAffectations] = await Promise.all([
    classes(personne.profileId),
    matieres(personne.profileId),
    membres(personne.profileId),
    affectations(personne.profileId),
  ]);

  const professeurs = listeMembres
    .filter((membre) => membre.roles.includes("professeur"))
    .map((membre) => ({ id: membre.profile_id, label: `${membre.nom} ${membre.prenom}` }));

  const optionsClasses = listeClasses.map((classe) => ({ id: classe.id, label: classe.label }));
  const optionsMatieres = listeMatieres.map((matiere) => ({
    id: matiere.id,
    label: matiere.label,
  }));

  // Un cours par ligne d'affectation, regroupé par classe pour la lecture.
  const parClasse = new Map<string, typeof listeAffectations>();
  for (const lien of listeAffectations) {
    const existantes = parClasse.get(lien.classe);
    if (existantes === undefined) parClasse.set(lien.classe, [lien]);
    else existantes.push(lien);
  }

  return (
    <>
      <TitreEspace
        titre="Classes"
        sousTitre={`${listeClasses.length} classe${listeClasses.length > 1 ? "s" : ""} · ${
          listeMatieres.length
        } matière${listeMatieres.length > 1 ? "s" : ""}`}
      />

      <div className="mt-8 grid gap-5 lg:grid-cols-2">
        <FormulaireClasse />
        <FormulaireMatiere />
      </div>

      <div className="mt-5">
        <FormulaireAffectation
          professeurs={professeurs}
          listeClasses={optionsClasses}
          matieres={optionsMatieres}
        />
      </div>

      <section className="mt-11">
        <h2 className="text-[length:var(--text-h2-app)] leading-[var(--text-h2-app--line-height)]">
          Cours de l&apos;établissement
        </h2>

        {listeAffectations.length === 0 ? (
          <p className="m-0 mt-3 max-w-[var(--spacing-lecture)] text-[color:var(--color-encre-faible)]">
            Aucun cours n&apos;existe encore. Un cours naît d&apos;une affectation :
            un professeur, une classe, une matière. C&apos;est lui qui apparaît
            ensuite dans le Studio.
          </p>
        ) : (
          <div className="mt-4 space-y-8">
            {[...parClasse.entries()].map(([classe, liens]) => (
              <div key={classe}>
                <h3 className="m-0 border-b border-[color:var(--color-bordure)] pb-2 text-[length:var(--text-tableau)] font-semibold uppercase tracking-[0.06em] text-[color:var(--color-encre-faible)]">
                  {classe}
                </h3>
                <ul className="m-0 list-none p-0">
                  {liens.map((lien) => (
                    <li
                      key={`${lien.teaching_space_id}-${lien.professeur_id ?? "vacant"}`}
                      className="flex min-h-[var(--spacing-cible)] flex-wrap items-center justify-between gap-3 border-b border-[color:var(--color-bordure)] px-1 py-3"
                    >
                      <span className="font-medium">{lien.matiere}</span>
                      {lien.professeur_id === null ? (
                        <span className="pastille pastille-attention">Sans professeur</span>
                      ) : (
                        <span className="text-[length:var(--text-tableau)] text-[color:var(--color-encre-faible)]">
                          {lien.nom} {lien.prenom}
                        </span>
                      )}
                    </li>
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>

      {listeClasses.length > 0 ? (
        <section className="mt-11">
          <h2 className="text-[length:var(--text-h2-app)] leading-[var(--text-h2-app--line-height)]">
            Effectifs
          </h2>
          <ul className="m-0 mt-4 grid list-none gap-3 p-0 sm:grid-cols-2 lg:grid-cols-4">
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
      ) : null}
    </>
  );
}
