import { ClipboardCheck, FileText } from "lucide-react";
import { EnTetePage, EtatVide, Etiquette, Ligne, ListeLignes, dateLisible } from "@/components/study/ui";
import type { ArchiveCours } from "@/lib/archives-professeur";

/** Vue de la page, rendue avec des données réelles (page.tsx) ou fictives (aperçu de développement). */
export function VueArchiveCours({ archive }: { archive: ArchiveCours }) {
  const { cours, chapitres, seances, devoirs } = archive;
  const groupes = [
    ...chapitres.map((ch) => ({ id: ch.id, titre: ch.label, seances: seances.filter((s) => s.chapter_id === ch.id) })),
    { id: "sans", titre: "Sans chapitre", seances: seances.filter((s) => s.chapter_id === null) },
  ].filter((g) => g.seances.length > 0);
  return (
    <>
      <EnTetePage
        filAriane={[
          { href: "/studio", libelle: "Mes cours" },
          { href: "/professeur/archives", libelle: "Années passées" },
        ]}
        sourcil={`${cours.annee} · Année archivée`}
        titre={`${cours.matiere} — ${cours.cible}`}
        sousTitre="Lecture seule. Ouvrez une séance pour la relire ou la réutiliser cette année."
      />

      {groupes.length === 0 ? (
        <EtatVide icone={FileText} titre="Aucune séance dans ce cours." texte="Rien n'avait été préparé dans ce cours cette année-là." />
      ) : (
        groupes.map((g) => (
          <section key={g.id} className="mb-8" aria-label={g.titre}>
            <h2 className="titre-section mb-3">{g.titre}</h2>
            <ListeLignes>
              {g.seances.map((s) => (
                <Ligne
                  key={s.id}
                  href={`/professeur/archives/${cours.id}/${s.id}`}
                  icone={FileText}
                  titre={s.title}
                  detail={s.scheduled_for ? dateLisible(s.scheduled_for) : "Sans date"}
                  fin={<Etiquette ton={s.state === "publiee" ? "succes" : "neutre"}>{s.state === "publiee" ? "Publiée" : "Non publiée"}</Etiquette>}
                />
              ))}
            </ListeLignes>
          </section>
        ))
      )}

      {devoirs.length > 0 ? (
        <section className="mb-8" aria-labelledby="devoirs">
          <h2 id="devoirs" className="titre-section mb-3">
            Devoirs
          </h2>
          <ListeLignes>
            {devoirs.map((d) => (
              <Ligne
                key={d.id}
                icone={ClipboardCheck}
                titre={d.title}
                detail={`${d.due_at ? `Pour le ${dateLisible(d.due_at)} · ` : ""}${d.remises} copie${d.remises > 1 ? "s" : ""} remise${d.remises > 1 ? "s" : ""}`}
              />
            ))}
          </ListeLignes>
          <p className="meta m-0 mt-2">Les copies restent conservées dans leur année ; elles ne sont pas affichées ici.</p>
        </section>
      ) : null}
    </>
  );
}
