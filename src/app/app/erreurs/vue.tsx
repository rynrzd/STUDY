import Link from "next/link";
import { Download, Lock, NotebookText } from "lucide-react";
import { EnTetePage, Encadre, EtatVide, ICONE, OngletsLiens, dateLisible } from "@/components/study/ui";
import { archiverErreur, lancerEntrainement } from "../reviser/actions";
import { AnnotationErreur } from "./AnnotationErreur";

export interface Entree {
  id: string;
  notion_id: string | null;
  notion: string | null;
  enonce: string;
  kind: string;
  choix: string[] | null;
  reponse: { index?: number; valeur?: string; texte?: string } | null;
  explication: string | null;
  categorie: string | null;
  note: string | null;
  revision: number;
  created_at: string;
  version_id: string;
  archived_at: string | null;
}



/** Vue de la page, rendue avec des données réelles (page.tsx) ou fictives (aperçu de développement). */
export function VueCarnet({ archivesVues, entrees, error, parNotion }: { archivesVues: boolean; entrees: readonly Entree[]; error: unknown; parNotion: Map<string, Entree[]> }) {
  return (
    <div className="mx-auto max-w-[960px]">
      <EnTetePage
        filAriane={[{ href: "/app/reviser", libelle: "Réviser" }]}
        sourcil="Carnet d'erreurs"
        titre="Tes erreurs, rangées pour y revenir."
        actions={
          <a href="/app/erreurs/export" className="bouton bouton-secondaire" download>
            <Download {...ICONE} /> Exporter (CSV)
          </a>
        }
      />
      <div className="mb-5">
        <Encadre icone={Lock} titre="Personne d'autre ne lit ce carnet.">
          Ni tes professeurs ni l&apos;administration. Une erreur ne dit rien de ton niveau : c&apos;est un endroit pour retravailler.
        </Encadre>
      </div>
      <OngletsLiens
        etiquette="Entrées du carnet"
        onglets={[
          { href: "/app/erreurs", libelle: "À retravailler", compte: archivesVues ? null : entrees.length, actif: !archivesVues },
          { href: "/app/erreurs?archives=1", libelle: "Avec les archives", compte: archivesVues ? entrees.length : null, actif: archivesVues },
        ]}
      />
      {error !== null ? (
        <p role="alert" className="text-[color:var(--color-erreur)]">
          Le carnet n&apos;a pas pu être chargé.
        </p>
      ) : entrees.length === 0 ? (
        <EtatVide icone={NotebookText} titre="Ton carnet est vide" texte="Quand une réponse d'entraînement n'est pas juste, elle se range ici avec son explication." />
      ) : (
        <div className="grid gap-8">
          {[...parNotion.entries()].map(([notion, liste]) => (
            <section key={notion} aria-label={notion}>
              <h2 className="titre-section mb-3 flex items-center gap-2">
                {notion} <span className="nombre">{liste.length}</span>
              </h2>
              <ul className="m-0 grid list-none gap-3 p-0">
                {liste.map((e) => (
                  <li key={e.id} className="panneau">
                    <p className="meta m-0">
                      {dateLisible(e.created_at, { day: "numeric", month: "long" })}
                      {e.archived_at ? " · archivée" : ""}
                    </p>
                    <p className="m-0 mt-1 font-semibold">{e.enonce}</p>
                    <div className="mt-3 grid gap-3 sm:grid-cols-2">
                      <div className="rounded-[12px] border border-[color:var(--color-bordure)] p-3 text-[0.875rem]">
                        <span className="meta block">Ta réponse</span>
                        <strong>
                          {e.kind === "qcm" && e.reponse?.index !== undefined ? (e.choix?.[e.reponse.index] ?? "—") : (e.reponse?.valeur ?? e.reponse?.texte ?? "—")}
                        </strong>
                      </div>
                      {e.explication ? (
                        <div className="rounded-[12px] bg-[color:var(--color-rose-clair)] p-3 text-[0.875rem]">
                          <span className="meta block">Explication</span>
                          {e.explication}
                        </div>
                      ) : null}
                    </div>
                    <AnnotationErreur entree={e.id} revision={e.revision} categorie={e.categorie ?? ""} note={e.note ?? ""} />
                    <div className="mt-3 flex flex-wrap gap-2">
                      <form action={lancerEntrainement}>
                        <input type="hidden" name="titre" value={`Réessayer — ${notion}`} />
                        <input type="hidden" name="version" value={e.version_id} />
                        <button type="submit" className="bouton bouton-primaire bouton-compact">
                          Réessayer
                        </button>
                      </form>
                      <Link href={`/app/aide?version=${e.version_id}`} className="bouton bouton-secondaire bouton-compact">
                        Débloque-moi
                      </Link>
                      <form action={archiverErreur}>
                        <input type="hidden" name="entree" value={e.id} />
                        <input type="hidden" name="restaurer" value={e.archived_at ? "oui" : "non"} />
                        <button type="submit" className="bouton bouton-discret bouton-compact">
                          {e.archived_at ? "Restaurer" : "Archiver"}
                        </button>
                      </form>
                    </div>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  );
}
