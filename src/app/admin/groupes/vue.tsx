import Link from "next/link";
import { ArrowRight, Layers, Users } from "lucide-react";
import { CreerGroupe } from "@/components/admin/GroupeFormulaires";
import { EnTetePage, EtatVide } from "@/components/study/ui";
import type { GroupeEtab } from "@/lib/etablissement";
import { RubriqueClasses } from "@/components/study/Rubriques";

/** Vue de la page, rendue avec des données réelles (page.tsx) ou fictives (aperçu de développement). */
export function VueGroupes({ liste }: { liste: readonly GroupeEtab[] }) {
  return (
    <>
      <RubriqueClasses actif="/admin/groupes" />
      <EnTetePage
        sourcil="Classes et groupes"
        titre="Groupes pédagogiques"
        sousTitre="Spécialités, langues, options, demi-groupes : un groupe réunit des élèves choisis, de plusieurs classes si besoin. Sa composition ne touche pas la classe principale des élèves."
      />

      <CreerGroupe />

      <section className="mt-8" aria-labelledby="liste">
        <h2 id="liste" className="titre-section mb-3 flex items-center gap-2">
          Groupes <span className="nombre">{liste.length}</span>
        </h2>
        {liste.length === 0 ? (
          <EtatVide
            icone={Layers}
            titre="Aucun groupe pour l'instant."
            texte="Créez-en un avec le formulaire ci-dessus, puis ajoutez-y des élèves et affectez un professeur."
          />
        ) : (
          <ul className="m-0 grid list-none gap-3 p-0 sm:grid-cols-2 xl:grid-cols-3">
            {liste.map((g) => (
              <li key={g.id}>
                <Link href={`/admin/groupes/${g.id}`} className="carte-chiffre carte-souleve min-h-0">
                  <span className="flex items-center justify-between gap-2">
                    <span className="tuile" aria-hidden="true">
                      {g.kind === "interclasses" ? <Layers size={20} strokeWidth={1.75} /> : <Users size={20} strokeWidth={1.75} />}
                    </span>
                    <span className="etiquette-etat">{g.kind === "interclasses" ? "Interclasses" : "Demi-groupe"}</span>
                  </span>
                  <span className="mt-2 block font-bold">{g.label}</span>
                  <span className="meta">{g.annee}</span>
                  <span className="mt-2 flex items-center justify-between gap-2">
                    <span className="meta">
                      {g.effectif} élève{g.effectif > 1 ? "s" : ""} · {g.cours} cours
                    </span>
                    <ArrowRight size={18} strokeWidth={1.75} aria-hidden="true" className="text-[color:var(--color-accent)]" />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
