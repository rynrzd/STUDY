import Link from "next/link";
import { redirect } from "next/navigation";
import { Confirmer } from "@/components/study/Dialogue";
import { EnTetePage, Etiquette, Panneau, dateLisible } from "@/components/study/ui";
import { clientUtilisateur } from "@/lib/supabase-serveur";
import { contexteApp } from "@/lib/v6/contexte";
import { basculerAnnee } from "./actions";
import { FormulaireAnnee } from "./FormulaireAnnee";

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
  annee_cible: string;
  classes_courantes: number;
  inscriptions_a_clore: number;
  classes_cible: number;
  inscriptions_cible: number;
  eleves_sans_classe_cible: number;
  deja_courante: boolean;
}

/**
 * D05 — Passage d'année. Préparer → contrôler (aperçu réel) → basculer.
 * Rien n'est supprimé ; relancer ne duplique rien ; la base refuse une année
 * sans classe. Les classes de l'année suivante viennent de l'assistant de
 * rentrée (import).
 */
export default async function PageAnnees() {
  const ctx = await contexteApp();
  if (!ctx.roles.admin) redirect("/app");
  const client = clientUtilisateur(ctx.jeton);
  const { data, error } = await client.from("academic_years").select("id, label, starts_on, ends_on, is_current, archived_at").order("starts_on", { ascending: false });
  const annees = (data ?? []) as Annee[];
  const courante = annees.find((a) => a.is_current) ?? null;
  const futures = annees.filter((a) => !a.is_current && a.archived_at === null && (!courante || a.starts_on > courante.starts_on));
  const apercus = await Promise.all(
    futures.map(async (a) => {
      const r = await client.rpc("annee_apercu", { p_cible: a.id });
      return { annee: a, apercu: ((r.data ?? []) as Apercu[])[0] ?? null, erreur: r.error !== null };
    }),
  );
  const debutSuivant = courante ? Number(courante.label.slice(0, 4)) + 1 : new Date().getFullYear();

  return (
    <div className="mx-auto max-w-[960px]">
      <EnTetePage titre="Années scolaires" sousTitre="Préparer l'année suivante, vérifier son impact, puis basculer. Rien n'est supprimé : l'année quittée est archivée." />
      {error !== null ? (
        <p role="alert" className="text-[color:var(--color-erreur)]">
          Les années n&apos;ont pas pu être chargées. Le second facteur de votre session est-il validé ?
        </p>
      ) : null}

      <Panneau titre="Année en cours">
        {courante ? (
          <p className="m-0">
            <span className="font-semibold">{courante.label}</span> · du {dateLisible(courante.starts_on)} au {dateLisible(courante.ends_on)}
          </p>
        ) : (
          <p className="m-0 text-[color:var(--color-encre-faible)]">Aucune année courante. L&apos;assistant de rentrée la crée au premier import.</p>
        )}
      </Panneau>

      <div className="mt-6">
        <Panneau titre="1. Préparer l'année suivante">
          <FormulaireAnnee suggestion={{ label: `${debutSuivant}-${debutSuivant + 1}`, debut: `${debutSuivant}-09-01`, fin: `${debutSuivant + 1}-07-05` }} />
        </Panneau>
      </div>

      {apercus.map(({ annee, apercu, erreur }) => (
        <div key={annee.id} className="mt-6">
          <Panneau titre={`2. Contrôler et basculer vers ${annee.label}`}>
            {erreur || !apercu ? (
              <p role="alert" className="m-0 text-[color:var(--color-erreur)]">
                L&apos;aperçu n&apos;a pas pu être calculé.
              </p>
            ) : (
              <>
                <dl className="m-0 grid gap-x-6 gap-y-2 sm:grid-cols-2">
                  <dt className="meta">Classes de {apercu.annee_courante ?? "l'année en cours"} archivées</dt>
                  <dd className="m-0 font-semibold">{apercu.classes_courantes}</dd>
                  <dt className="meta">Inscriptions closes à la date du passage</dt>
                  <dd className="m-0 font-semibold">{apercu.inscriptions_a_clore}</dd>
                  <dt className="meta">Classes prêtes en {annee.label}</dt>
                  <dd className="m-0 font-semibold">{apercu.classes_cible}</dd>
                  <dt className="meta">Élèves déjà inscrits en {annee.label}</dt>
                  <dd className="m-0 font-semibold">{apercu.inscriptions_cible}</dd>
                  <dt className="meta">Élèves actifs encore sans classe en {annee.label}</dt>
                  <dd className="m-0 font-semibold">
                    {apercu.eleves_sans_classe_cible} {apercu.eleves_sans_classe_cible > 0 ? <Etiquette ton="attention">à vérifier</Etiquette> : null}
                  </dd>
                </dl>
                <p className="meta m-0 mt-4">
                  Avant de basculer : exportez les listes utiles depuis <Link href="/admin/utilisateurs">Utilisateurs</Link>. Les classes de{" "}
                  {annee.label} se créent avec <Link href="/admin/import">l&apos;assistant de rentrée</Link>.
                </p>
                <div className="mt-4">
                  {apercu.classes_cible === 0 ? (
                    <p className="m-0 font-semibold">Importez d&apos;abord au moins une classe de {annee.label} : la bascule est refusée sans classe.</p>
                  ) : (
                    <Confirmer
                      declencheur={`Basculer vers ${annee.label}`}
                      titre={`Basculer vers ${annee.label} ?`}
                      critique
                      variante="primaire"
                      impact={`${apercu.classes_courantes} classe(s) archivée(s), ${apercu.inscriptions_a_clore} inscription(s) close(s), aucune donnée supprimée. Relancer ne fera rien de plus.`}
                    >
                      <form action={basculerAnnee}>
                        <input type="hidden" name="annee" value={annee.id} />
                        <button type="submit" className="bouton bouton-primaire">
                          Confirmer la bascule
                        </button>
                      </form>
                    </Confirmer>
                  )}
                </div>
              </>
            )}
          </Panneau>
        </div>
      ))}

      {annees.some((a) => a.archived_at) ? (
        <div className="mt-6">
          <Panneau titre="Années archivées">
            <ul className="m-0 grid gap-1 pl-5">
              {annees
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
