import { Archive, BookOpen } from "lucide-react";
import { RubriqueCours } from "@/components/study/Rubriques";
import { EnTetePage, EtatVide, Ligne, ListeLignes } from "@/components/study/ui";
import type { CoursArchive } from "@/lib/archives-professeur";

/** Vue de la page, rendue avec des données réelles (page.tsx) ou fictives (aperçu de développement). */
export function VueArchivesProfesseur({ cours }: { cours: readonly CoursArchive[] | null }) {
  const annees = [...new Set((cours ?? []).map((c) => c.annee))];
  return (
    <>
      <RubriqueCours actif="/professeur/archives" />
      <EnTetePage
        sourcil="Mes cours"
        titre="Années passées"
        sousTitre="Vos cours des années archivées, en lecture seule. Une séance peut être réutilisée dans un cours de cette année : la copie part en brouillon, sans devoir ni copie d'élève."
      />
      {cours === null ? (
        <p role="alert" className="m-0 text-[color:var(--color-erreur)]">
          Les années passées n&apos;ont pas pu être chargées. Réessayez dans un instant.
        </p>
      ) : cours.length === 0 ? (
        <EtatVide
          icone={Archive}
          titre="Aucune année archivée pour l'instant."
          texte="Après le passage à l'année suivante, les cours dont vous étiez titulaire ou co-intervenant apparaissent ici. Un remplacement ne donne pas accès aux archives."
        />
      ) : (
        annees.map((annee) => (
          <section key={annee} className="mb-8" aria-labelledby={`annee-${annee}`}>
            <h2 id={`annee-${annee}`} className="titre-section mb-3 flex items-center gap-2">
              {annee} <span className="etiquette-etat">Année archivée</span>
            </h2>
            <ListeLignes>
              {cours
                .filter((c) => c.annee === annee)
                .map((c) => (
                  <Ligne
                    key={c.espace}
                    href={`/professeur/archives/${c.espace}`}
                    icone={BookOpen}
                    titre={`${c.matiere} — ${c.cible}`}
                    detail={`${c.genre === "groupe" ? "Groupe · " : ""}${c.seances} séance${c.seances > 1 ? "s" : ""} · ${c.devoirs} devoir${c.devoirs > 1 ? "s" : ""}`}
                  />
                ))}
            </ListeLignes>
          </section>
        ))
      )}
    </>
  );
}
