import Link from "next/link";
import { redirect } from "next/navigation";
import { EnTetePage, EtatVide, Etiquette, Panneau, dateLisible } from "@/components/study/ui";
import { clientUtilisateur } from "@/lib/supabase-serveur";
import { contexteApp } from "@/lib/v6/contexte";
import { FormulaireAnnee } from "./FormulaireAnnee";
import { FormulaireBascule, FormulaireClasse, FormulairePreinscription } from "./Formulaires";

export const metadata = { title: "Années scolaires" };
export const dynamic = "force-dynamic";

interface Annee {
  id: string;
  label: string;
  starts_on: string;
  ends_on: string;
  is_current: boolean;
  archived_at: string | null;
}
interface Apercu {
  annee_courante: string | null;
  classes_courantes: number;
  inscriptions_a_clore: number;
  classes_cible: number;
  inscriptions_cible: number;
  eleves_sans_classe_cible: number;
}

/**
 * D05 — Passage d'année : préparer → classes → reconduire les élèves →
 * contrôler (liste nominative de ceux qui perdraient leur classe) → basculer.
 * Tous les contrôles sont en base (0059) ; rien n'est supprimé.
 */
export default async function PageAnnees() {
  const ctx = await contexteApp();
  if (!ctx.roles.admin) redirect("/app");
  const client = clientUtilisateur(ctx.jeton);
  const [annees, classes] = await Promise.all([
    client.from("academic_years").select("id, label, starts_on, ends_on, is_current, archived_at").order("starts_on", { ascending: false }),
    client.from("classes").select("id, label, academic_year_id, archived_at").is("archived_at", null).order("label"),
  ]);
  const liste = (annees.data ?? []) as Annee[];
  const toutes = (classes.data ?? []) as { id: string; label: string; academic_year_id: string }[];
  const courante = liste.find((a) => a.is_current) ?? null;
  const cible = liste.find((a) => !a.is_current && a.archived_at === null && (!courante || a.starts_on > courante.starts_on)) ?? null;

  const classesCourantes = courante ? toutes.filter((c) => c.academic_year_id === courante.id) : [];
  const classesCible = cible ? toutes.filter((c) => c.academic_year_id === cible.id) : [];
  const [apercu, sansClasse, effectifs] = cible
    ? await Promise.all([
        client.rpc("annee_apercu", { p_cible: cible.id }),
        client.rpc("annee_eleves_sans_classe", { p_cible: cible.id }),
        client.from("class_enrollments").select("class_id").is("ends_on", null).in("class_id", classesCourantes.map((c) => c.id)),
      ])
    : [null, null, null];
  const resume = ((apercu?.data ?? []) as Apercu[])[0] ?? null;
  const eleves = (sansClasse?.data ?? []) as { profile_id: string; prenom: string; nom: string; identifiant: string; classe_actuelle: string | null }[];
  const parClasse = new Map<string, number>();
  for (const e of (effectifs?.data ?? []) as { class_id: string }[]) parClasse.set(e.class_id, (parClasse.get(e.class_id) ?? 0) + 1);
  const debutSuivant = courante ? Number(courante.label.slice(0, 4)) + 1 : new Date().getFullYear();

  return (
    <div className="mx-auto max-w-[1000px]">
      <EnTetePage titre="Années scolaires" sousTitre="Préparer l'année suivante, reconduire les élèves, vérifier, puis basculer. Rien n'est supprimé." />
      {annees.error !== null ? (
        <p role="alert" className="text-[color:var(--color-erreur)]">
          Les années n&apos;ont pas pu être chargées. Le second facteur de votre session est-il validé ?
        </p>
      ) : null}

      <Panneau titre="Année en cours">
        {courante ? (
          <p className="m-0">
            <span className="font-semibold">{courante.label}</span> · du {dateLisible(courante.starts_on)} au {dateLisible(courante.ends_on)} ·{" "}
            {classesCourantes.length} classe{classesCourantes.length > 1 ? "s" : ""}
          </p>
        ) : (
          <p className="m-0 text-[color:var(--color-encre-faible)]">Aucune année courante. L&apos;assistant de rentrée la crée au premier import.</p>
        )}
      </Panneau>

      {!cible ? (
        <div className="mt-6">
          <Panneau titre="1. Préparer l'année suivante">
            <FormulaireAnnee suggestion={{ label: `${debutSuivant}-${debutSuivant + 1}`, debut: `${debutSuivant}-09-01`, fin: `${debutSuivant + 1}-07-05` }} />
          </Panneau>
        </div>
      ) : (
        <>
          <div className="mt-6">
            <Panneau titre={`2. Classes de ${cible.label}`}>
              {classesCible.length === 0 ? (
                <p className="m-0 mb-4 text-[color:var(--color-encre-faible)]">Aucune classe pour l&apos;instant.</p>
              ) : (
                <ul className="m-0 mb-4 flex list-none flex-wrap gap-2 p-0">
                  {classesCible.map((c) => (
                    <li key={c.id}>
                      <Etiquette ton="rose">{c.label}</Etiquette>
                    </li>
                  ))}
                </ul>
              )}
              <FormulaireClasse annee={cible.id} />
            </Panneau>
          </div>

          <div className="mt-6">
            <Panneau titre="3. Reconduire les élèves">
              {classesCible.length === 0 ? (
                <p className="m-0 text-[color:var(--color-encre-faible)]">Créez d&apos;abord au moins une classe de {cible.label}.</p>
              ) : classesCourantes.length === 0 ? (
                <EtatVide titre="Aucune classe en cours" texte="Il n'y a pas d'élève à reconduire." />
              ) : (
                <>
                  <p className="meta m-0 mb-2">
                    Les élèves sont préinscrits dans l&apos;année suivante, sans perdre leur classe actuelle. L&apos;inscription devient
                    principale à la bascule. Relancer n&apos;inscrit personne deux fois.
                  </p>
                  <div>
                    {classesCourantes.map((c) => (
                      <FormulairePreinscription key={c.id} source={c.id} libelle={c.label} effectif={parClasse.get(c.id) ?? 0} cibles={classesCible} />
                    ))}
                  </div>
                </>
              )}
            </Panneau>
          </div>

          <div className="mt-6">
            <Panneau titre={`4. Contrôler et basculer vers ${cible.label}`}>
              {resume === null ? (
                <p role="alert" className="m-0 text-[color:var(--color-erreur)]">
                  L&apos;aperçu n&apos;a pas pu être calculé.
                </p>
              ) : (
                <>
                  <dl className="m-0 grid gap-x-6 gap-y-2 sm:grid-cols-2">
                    <dt className="meta">Classes de {resume.annee_courante ?? "l'année en cours"} archivées</dt>
                    <dd className="m-0 font-semibold">{resume.classes_courantes}</dd>
                    <dt className="meta">Inscriptions closes (la veille du passage)</dt>
                    <dd className="m-0 font-semibold">{resume.inscriptions_a_clore}</dd>
                    <dt className="meta">Classes prêtes en {cible.label}</dt>
                    <dd className="m-0 font-semibold">{resume.classes_cible}</dd>
                    <dt className="meta">Élèves préinscrits en {cible.label}</dt>
                    <dd className="m-0 font-semibold">{resume.inscriptions_cible}</dd>
                  </dl>
                  {eleves.length > 0 ? (
                    <div className="mt-4 rounded-[12px] border border-[color:var(--color-attention)] p-4">
                      <p className="m-0 font-semibold text-[color:var(--color-attention)]">
                        {eleves.length} élève{eleves.length > 1 ? "s" : ""} actif{eleves.length > 1 ? "s" : ""} sans classe en {cible.label}
                      </p>
                      <ul className="m-0 mt-2 grid max-h-[240px] gap-1 overflow-y-auto pl-5 text-[0.875rem]">
                        {eleves.map((e) => (
                          <li key={e.profile_id}>
                            {e.prenom} {e.nom} · {e.identifiant}
                            {e.classe_actuelle ? ` · actuellement en ${e.classe_actuelle}` : ""}
                          </li>
                        ))}
                      </ul>
                    </div>
                  ) : (
                    <p className="m-0 mt-4 font-semibold text-[color:var(--color-succes)]">Chaque élève actif a une classe en {cible.label}.</p>
                  )}
                  <p className="meta m-0 mt-4">
                    Avant de basculer, exportez les listes utiles depuis <Link href="/admin/utilisateurs">Utilisateurs</Link>. L&apos;année quittée
                    est archivée ; ses classes, inscriptions et messages restent en base.
                  </p>
                  <div className="mt-4">
                    {resume.classes_cible === 0 ? (
                      <p className="m-0 font-semibold">Bascule impossible : aucune classe en {cible.label}.</p>
                    ) : (
                      <FormulaireBascule annee={cible.id} label={cible.label} sansClasse={eleves.length} />
                    )}
                  </div>
                </>
              )}
            </Panneau>
          </div>
        </>
      )}

      {liste.some((a) => a.archived_at) ? (
        <div className="mt-6">
          <Panneau titre="Années archivées">
            <ul className="m-0 grid gap-1 pl-5">
              {liste
                .filter((a) => a.archived_at)
                .map((a) => (
                  <li key={a.id}>{a.label}</li>
                ))}
            </ul>
          </Panneau>
        </div>
      ) : null}
    </div>
  );
}
