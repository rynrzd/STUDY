import Link from "next/link";
import { Download, NotebookText } from "lucide-react";
import { EnTetePage, EtatVide, ICONE, Panneau, dateLisible } from "@/components/study/ui";
import { clientUtilisateur } from "@/lib/supabase-serveur";
import { contexteApp } from "@/lib/v6/contexte";
import { archiverErreur, lancerEntrainement } from "../reviser/actions";
import { AnnotationErreur } from "./AnnotationErreur";

export const metadata = { title: "Carnet d'erreurs" };
export const dynamic = "force-dynamic";

interface Entree {
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

/**
 * E23 — Carnet d'erreurs : un repère privé, jamais un diagnostic. Classé par
 * notion ; chaque entrée garde la tentative, l'explication, une catégorie et
 * une note de l'élève ; on peut réessayer, archiver, exporter. Ni le
 * professeur ni l'administration ne le lisent.
 */
export default async function PageCarnet({ searchParams }: { searchParams: Promise<{ archives?: string }> }) {
  const ctx = await contexteApp();
  const { archives } = await searchParams;
  const { data, error } = await clientUtilisateur(ctx.jeton).rpc("carnet_lire", { p_archivees: archives === "1" });
  const entrees = ((data ?? []) as Entree[]).filter((e) => (archives === "1" ? true : e.archived_at === null));
  const parNotion = new Map<string, Entree[]>();
  for (const e of entrees) parNotion.set(e.notion ?? "Sans notion", [...(parNotion.get(e.notion ?? "Sans notion") ?? []), e]);

  return (
    <>
      <EnTetePage
        filAriane={[{ href: "/app/reviser", libelle: "Réviser" }]}
        titre="Mon carnet d'erreurs"
        sousTitre="Tes erreurs, rangées pour y revenir. Personne d'autre ne les voit."
        actions={
          <>
            <Link href={archives === "1" ? "/app/erreurs" : "/app/erreurs?archives=1"} className="bouton bouton-secondaire">
              {archives === "1" ? "Masquer les archives" : "Voir les archives"}
            </Link>
            <a href="/app/erreurs/export" className="bouton bouton-secondaire" download>
              <Download {...ICONE} /> Exporter (CSV)
            </a>
          </>
        }
      />
      {error !== null ? (
        <p role="alert" className="text-[color:var(--color-erreur)]">
          Le carnet n&apos;a pas pu être chargé.
        </p>
      ) : entrees.length === 0 ? (
        <EtatVide icone={NotebookText} titre="Ton carnet est vide" texte="Quand une réponse d'entraînement n'est pas juste, elle se range ici avec son explication. Une seule erreur ne dit rien de ton niveau." />
      ) : (
        <div className="grid gap-6">
          {[...parNotion.entries()].map(([notion, liste]) => (
            <Panneau key={notion} titre={`${notion} (${liste.length})`}>
              <ul className="m-0 grid list-none gap-5 p-0">
                {liste.map((e) => (
                  <li key={e.id} className="border-b border-[color:var(--color-bordure)] pb-5 last:border-0 last:pb-0">
                    <p className="meta m-0">{dateLisible(e.created_at, { day: "numeric", month: "long" })}</p>
                    <p className="m-0 mt-1 font-medium">{e.enonce}</p>
                    <p className="m-0 mt-2 text-[0.875rem]">
                      Ta réponse :{" "}
                      <strong>
                        {e.kind === "qcm" && e.reponse?.index !== undefined ? (e.choix?.[e.reponse.index] ?? "—") : (e.reponse?.valeur ?? e.reponse?.texte ?? "—")}
                      </strong>
                    </p>
                    {e.explication ? (
                      <p className="m-0 mt-2 rounded-[10px] bg-[color:var(--color-surface-douce)] p-3 text-[0.875rem]">Explication : {e.explication}</p>
                    ) : null}
                    <AnnotationErreur entree={e.id} revision={e.revision} categorie={e.categorie ?? ""} note={e.note ?? ""} />
                    <div className="mt-3 flex flex-wrap gap-2">
                      <form action={lancerEntrainement}>
                        <input type="hidden" name="titre" value={`Réessayer — ${notion}`} />
                        <input type="hidden" name="version" value={e.version_id} />
                        <button type="submit" className="bouton bouton-secondaire bouton-compact">
                          Réessayer
                        </button>
                      </form>
                      <Link href={`/app/aide?version=${e.version_id}`} className="bouton bouton-discret bouton-compact">
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
            </Panneau>
          ))}
        </div>
      )}
    </>
  );
}
