import { BookOpen, Layers, Users } from "lucide-react";
import { AffecterProfesseurGroupe, AjouterEleves, RetirerEleve } from "@/components/admin/GroupeFormulaires";
import { EnTetePage } from "@/components/study/ui";
import type { CoursGroupe, GroupeEtab, MembreGroupe } from "@/lib/etablissement";

type Option = { id: string; label: string };

/** Vue de la fiche, rendue avec des données réelles (page.tsx) ou fictives (aperçu). */
export function VueGroupe({
  groupe,
  membres,
  cours,
  eligibles,
  professeurs,
  matieres,
}: {
  groupe: GroupeEtab;
  membres: readonly MembreGroupe[];
  cours: readonly CoursGroupe[];
  eligibles: readonly { profile_id: string; prenom: string; nom: string; classe: string | null }[];
  professeurs: readonly Option[];
  matieres: readonly Option[];
}) {
  const classesSources = [...new Set(membres.map((m) => m.classe).filter((c): c is string => c !== null))];

  return (
    <>
      <EnTetePage
        filAriane={[
          { href: "/admin/groupes", libelle: "Groupes" },
          { href: `/admin/groupes/${groupe.id}`, libelle: groupe.label },
        ]}
        sourcil={groupe.kind === "interclasses" ? "Groupe interclasses" : "Demi-groupe"}
        titre={groupe.label}
        sousTitre={`${groupe.annee} · ${membres.length} élève${membres.length > 1 ? "s" : ""}${classesSources.length > 1 ? ` de ${classesSources.length} classes` : ""} · ${cours.length} cours`}
      />

      <section aria-labelledby="cours" className="mb-8">
        <h2 id="cours" className="titre-section mb-3">
          Cours du groupe
        </h2>
        <div className="panneau">
          <div className="flex items-start gap-3">
            <span className="tuile" aria-hidden="true">
              <BookOpen size={20} strokeWidth={1.75} />
            </span>
            <div className="min-w-0">
              <p className="m-0 font-bold">Affecter un professeur</p>
              <p className="meta m-0 mt-1 max-w-[62ch]">Un professeur et une matière ouvrent un cours visible par les seuls membres de ce groupe, dans son Studio.</p>
            </div>
          </div>
          <div className="mt-4">
            <AffecterProfesseurGroupe groupe={groupe.id} professeurs={professeurs} matieres={matieres} />
          </div>

          {cours.length > 0 ? (
            <ul className="liste-r2 mt-4" aria-label="Cours existants">
              {cours.map((c) => (
                <li key={c.teaching_space_id} className="flex items-center justify-between gap-3">
                  <span className="font-semibold">{c.matiere}</span>
                  {c.professeur_id === null ? (
                    <span className="puce-cours" data-ton="attention">
                      Sans professeur
                    </span>
                  ) : (
                    <span className="text-[color:var(--color-encre-faible)]">
                      {c.prenom} {c.nom}
                    </span>
                  )}
                </li>
              ))}
            </ul>
          ) : null}
        </div>
      </section>

      <section aria-labelledby="membres">
        <h2 id="membres" className="titre-section mb-3 flex items-center gap-2">
          Membres <span className="nombre">{membres.length}</span>
        </h2>

        <div className="grid gap-4 lg:grid-cols-2">
          <div className="panneau">
            <p className="m-0 flex items-center gap-2 font-bold">
              <Users size={18} strokeWidth={1.75} aria-hidden="true" /> Élèves du groupe
            </p>
            {membres.length === 0 ? (
              <p className="meta m-0 mt-3">Aucun élève pour l&apos;instant. Ajoutez-en avec la liste à droite.</p>
            ) : (
              <ul className="m-0 mt-3 list-none p-0">
                {membres.map((m) => (
                  <li key={m.profile_id} className="flex items-center justify-between gap-3 border-b border-[color:var(--bordure-douce,var(--color-bordure))] py-2.5 last:border-0">
                    <span className="min-w-0">
                      <span className="font-semibold">{m.nom.toUpperCase()}</span> {m.prenom}
                      <span className="meta block">{m.classe ?? "Sans classe"}</span>
                    </span>
                    <RetirerEleve groupe={groupe.id} eleve={m.profile_id} nom={`${m.prenom} ${m.nom}`} />
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="panneau">
            <p className="m-0 flex items-center gap-2 font-bold">
              <Layers size={18} strokeWidth={1.75} aria-hidden="true" /> Ajouter des élèves
            </p>
            <p className="meta m-0 mt-1">Cherchez, filtrez par classe, cochez, puis ajoutez d&apos;un coup.</p>
            <div className="mt-3">
              <AjouterEleves groupe={groupe.id} eligibles={eligibles} />
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
