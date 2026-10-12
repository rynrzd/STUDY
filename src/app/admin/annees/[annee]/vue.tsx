import { Archive, BookOpen, Layers, School } from "lucide-react";
import { CarteChiffre, EnTetePage, Encadre, EtatVide, Etiquette, dateLisible } from "@/components/study/ui";
import type { AnneeArchivee } from "@/lib/etablissement";

/** Vue de la page, rendue avec des données réelles (page.tsx) ou fictives (aperçu de développement). */
export function VueAnneeArchivee({ releve }: { releve: AnneeArchivee }) {
  const { annee, classes, groupes, cours } = releve;
  const effectif = classes.reduce((n, c) => n + c.effectif, 0);
  return (
    <div className="mx-auto max-w-[1000px]">
      <EnTetePage
        filAriane={[{ href: "/admin/annees", libelle: "Années scolaires" }]}
        sourcil="Année archivée"
        titre={annee.label}
        sousTitre={
          <span className="flex flex-wrap items-center gap-2">
            <Etiquette ton="neutre">Année archivée</Etiquette>
            Du {dateLisible(annee.debut)} au {dateLisible(annee.fin)} · archivée le {dateLisible(annee.archivee_le)}
          </span>
        }
      />

      <Encadre icone={Archive} titre="Lecture seule.">
        Ce relevé montre ce qui existait cette année-là. Rien ne s&apos;y modifie, et aucun élève n&apos;y retrouve l&apos;accès : copies,
        corrections et séances restent conservées dans leur année d&apos;origine.
      </Encadre>

      <section aria-label="Chiffres de l'année" className="mt-6 grid gap-3 sm:grid-cols-3">
        <CarteChiffre icone={School} libelle="Classes" valeur={classes.length} detail={`${effectif} inscription${effectif > 1 ? "s" : ""} d'élèves`} />
        <CarteChiffre icone={Layers} libelle="Groupes" valeur={groupes.length} detail="Spécialités, options, demi-groupes" />
        <CarteChiffre icone={BookOpen} libelle="Cours" valeur={cours.length} detail={`${cours.reduce((n, c) => n + c.seances_publiees, 0)} séances publiées`} />
      </section>

      <section className="mt-8" aria-labelledby="classes">
        <h2 id="classes" className="titre-section mb-3">
          Classes
        </h2>
        {classes.length === 0 ? (
          <EtatVide icone={School} titre="Aucune classe cette année-là." texte="L'année a été créée sans classe." />
        ) : (
          <ul className="m-0 grid list-none gap-3 p-0 sm:grid-cols-2 lg:grid-cols-3">
            {classes.map((c) => (
              <li key={c.id} className="panneau p-4 md:p-4">
                <span className="block font-bold">{c.label}</span>
                <span className="meta block">
                  {c.effectif} élève{c.effectif > 1 ? "s" : ""}
                  {c.professeur_principal ? ` · PP : ${c.professeur_principal}` : ""}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {groupes.length > 0 ? (
        <section className="mt-8" aria-labelledby="groupes">
          <h2 id="groupes" className="titre-section mb-3">
            Groupes
          </h2>
          <ul className="m-0 flex list-none flex-wrap gap-2 p-0">
            {groupes.map((g) => (
              <li key={g.id} className="puce-cours">
                <span className="font-semibold">{g.label}</span> · {g.kind === "interclasses" ? "interclasses" : "demi-groupe"} · {g.effectif} élève{g.effectif > 1 ? "s" : ""}
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className="mt-8" aria-labelledby="cours">
        <h2 id="cours" className="titre-section mb-3">
          Cours et professeurs
        </h2>
        {cours.length === 0 ? (
          <p className="meta m-0">Aucun cours n&apos;a été ouvert cette année-là.</p>
        ) : (
          <div className="panneau p-0 md:p-0">
            <ul className="m-0 list-none p-0">
              {cours.map((c, i) => (
                <li key={`${c.cible}-${c.matiere}-${i}`} className="ligne-annee-archivee">
                  <span className="min-w-0">
                    <span className="block font-semibold">
                      {c.matiere} · {c.cible}
                      {c.genre === "groupe" ? <span className="meta"> (groupe)</span> : null}
                    </span>
                    <span className="meta block">{c.professeurs?.replaceAll("(remplacant)", "(remplaçant)").replaceAll("(co_intervenant)", "(co-intervenant)") ?? "Sans professeur"}</span>
                  </span>
                  <span className="meta shrink-0 text-right">
                    {c.seances_publiees} séance{c.seances_publiees > 1 ? "s" : ""} · {c.devoirs} devoir{c.devoirs > 1 ? "s" : ""}
                  </span>
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>
    </div>
  );
}
