import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Etiquette, Panneau } from "@/components/study/ui";
import { jetonAccesDe, sessionCourante } from "@/lib/session-serveur";
import { seance as lireSeance } from "@/lib/studio";
import { clientUtilisateur } from "@/lib/supabase-serveur";
import { archiverExercice, publierVersion } from "./actions";
import { FormulaireExercice } from "./FormulaireExercice";

export const metadata = { title: "Exercices de la séance" };
export const dynamic = "force-dynamic";

/**
 * E21 (exercices) — la banque versionnée d'une séance. Les élèves ne voient
 * que la dernière version publiée ; la correction reste dans sa table.
 */
export default async function PageExercicesStudio({ params, searchParams }: { params: Promise<{ seance: string }>; searchParams: Promise<{ version?: string }> }) {
  const personne = await sessionCourante();
  if (personne === null) redirect("/connexion");
  const jeton = await jetonAccesDe(personne);
  if (jeton === null) redirect("/connexion");
  const { seance: id } = await params;
  const { version: base } = await searchParams;
  const s = await lireSeance(jeton, id);
  if (s === null) notFound();
  const client = clientUtilisateur(jeton);
  const [exercices, notions, agregats] = await Promise.all([
    client
      .from("exercices")
      .select("id, notion_id, archived_at, exercice_versions(id, version, kind, enonce, choix, published_at)")
      .eq("lesson_id", id)
      .is("archived_at", null)
      .order("created_at"),
    client.from("notions").select("id, label").eq("teaching_space_id", s.teaching_space_id).is("archived_at", null).order("label"),
    client.rpc("revision_agregats", { p_espace: s.teaching_space_id }),
  ]);
  const liste = (exercices.data ?? []) as {
    id: string;
    notion_id: string | null;
    exercice_versions: { id: string; version: number; kind: string; enonce: string; choix: string[] | null; published_at: string | null }[];
  }[];
  const lesNotions = (notions.data ?? []) as { id: string; label: string }[];
  const versionBase = base ? liste.flatMap((e) => e.exercice_versions.map((v) => ({ e, v }))).find((x) => x.v.id === base) : undefined;

  return (
    <>
      <nav className="mb-6">
        <Link href={`/studio/${id}`} className="lien-fleche text-[0.875rem]">
          ← {s.title}
        </Link>
      </nav>
      <h1 className="titre-page mb-6">Exercices et notions</h1>
      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_420px]">
        <div className="grid content-start gap-4">
          {liste.length === 0 ? <p className="panneau m-0">Aucun exercice pour cette séance. Ceux que vous publiez alimentent l&apos;entraînement, les quiz et Débloque-moi.</p> : null}
          {liste.map((e) => {
            const versions = [...e.exercice_versions].sort((a, b) => b.version - a.version);
            const derniere = versions[0];
            const publiee = versions.find((v) => v.published_at);
            return (
              <section key={e.id} className="panneau">
                <div className="mb-2 flex flex-wrap items-center gap-2">
                  <Etiquette>{derniere?.kind === "qcm" ? "QCM" : derniere?.kind === "numerique" ? "Numérique" : "Rédigé"}</Etiquette>
                  {publiee ? <Etiquette ton="succes">Publiée : v{publiee.version}</Etiquette> : <Etiquette ton="attention">Brouillon</Etiquette>}
                  {e.notion_id ? <span className="meta">{lesNotions.find((n) => n.id === e.notion_id)?.label}</span> : null}
                </div>
                <p className="m-0">{derniere?.enonce}</p>
                <div className="mt-3 flex flex-wrap gap-2">
                  {derniere && !derniere.published_at ? (
                    <form action={publierVersion}>
                      <input type="hidden" name="version" value={derniere.id} />
                      <input type="hidden" name="seance" value={id} />
                      <button type="submit" className="bouton bouton-primaire bouton-compact">
                        Publier v{derniere.version}
                      </button>
                    </form>
                  ) : null}
                  {derniere ? (
                    <Link href={`/studio/${id}/exercices?version=${derniere.id}`} className="bouton bouton-secondaire bouton-compact">
                      Nouvelle version
                    </Link>
                  ) : null}
                  <form action={archiverExercice}>
                    <input type="hidden" name="exercice" value={e.id} />
                    <input type="hidden" name="seance" value={id} />
                    <button type="submit" className="bouton bouton-discret bouton-compact">
                      Retirer
                    </button>
                  </form>
                </div>
                <p className="meta m-0 mt-2">{versions.length} version{versions.length > 1 ? "s" : ""} ; les tentatives passées gardent la version sur laquelle elles portaient.</p>
              </section>
            );
          })}
          <Panneau titre="Notions à revoir dans ce cours">
            <ul className="m-0 grid list-none gap-1 p-0">
              {((agregats.data ?? []) as { notion_id: string; notion: string; a_revoir: number | null; masque: boolean }[]).map((a) => (
                <li key={a.notion_id} className="flex justify-between gap-2">
                  <span>{a.notion}</span>
                  <span className="meta">{a.masque ? "moins de 5 élèves — non affiché" : `${a.a_revoir} élèves`}</span>
                </li>
              ))}
            </ul>
            <p className="meta m-0 mt-3">Agrégats seulement, masqués sous cinq personnes. Le détail individuel reste privé.</p>
          </Panneau>
        </div>
        <Panneau titre={versionBase ? `Nouvelle version (après v${versionBase.v.version})` : "Nouvel exercice"} as="aside">
          <FormulaireExercice
            seance={id}
            notions={lesNotions}
            base={versionBase ? { exercice: versionBase.e.id, kind: versionBase.v.kind, enonce: versionBase.v.enonce, choix: versionBase.v.choix ?? [], notion: versionBase.e.notion_id } : undefined}
          />
        </Panneau>
      </div>
    </>
  );
}
