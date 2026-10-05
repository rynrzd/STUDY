import Link from "next/link";
import { Bookmark, BookmarkCheck, Dumbbell, FileText, HandHelping, MessageCircleQuestion, Sparkles } from "lucide-react";
import { Entraide } from "@/components/app/Entraide";
import { VueSeance } from "@/components/seance/VueSeance";
import { RenduDocument } from "@/components/studio/RenduDocument";
import { LectureSeance } from "@/components/study/LectureSeance";
import { NotePrivee } from "@/components/study/NotePrivee";
import { AccesIndisponible, EnTetePage, Etiquette, EtatVide, ICONE, Panneau, dateLisible } from "@/components/study/ui";
import { dejaSignales } from "@/lib/moderation";
import { filsDeLaSeance } from "@/lib/parcours-eleve";
import { clientUtilisateur } from "@/lib/supabase-serveur";
import { contexteApp } from "@/lib/v6/contexte";
import { exercicesDeLaSeance, notePersonnelle, reperesDeLaSeance, seanceDetail } from "@/lib/v6/cours";
import { basculerRepere, sEntrainer } from "../actions";

export const metadata = { title: "Séance" };
export const dynamic = "force-dynamic";

const ONGLETS = [
  { cle: "cours", libelle: "Cours" },
  { cle: "exercices", libelle: "Exercices" },
  { cle: "questions", libelle: "Questions" },
] as const;

/**
 * E03 — Séance. Lire, comprendre et agir au même endroit : la prose à
 * gauche (720 px au plus), les outils, le repère « à revoir » et la note
 * privée à droite (sous le cours sur téléphone). La source et sa version
 * sont visibles. Une séance d'une autre classe, ou un brouillon, n'est « pas
 * accessible » — sans titre ni autre indice.
 */
export default async function PageSeance({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ onglet?: string }>;
}) {
  const ctx = await contexteApp();
  const { id } = await params;
  const { onglet: ongletDemande } = await searchParams;
  const onglet = ONGLETS.some((o) => o.cle === ongletDemande) ? ongletDemande! : "cours";

  const seance = await seanceDetail(ctx.jeton, id);
  // Un élève ne voit qu'une séance publiée ; un brouillon reste au Studio.
  if (seance === null || (seance.etat !== "publiee" && !ctx.roles.professeur)) {
    return <AccesIndisponible retour="/app/cours" />;
  }

  const [exercices, note, reperes, salon, fils, signales] = await Promise.all([
    exercicesDeLaSeance(ctx.jeton, id),
    notePersonnelle(ctx.jeton, id),
    reperesDeLaSeance(ctx.jeton, id),
    clientUtilisateur(ctx.jeton).from("salons").select("id, class_id").eq("teaching_space_id", seance.coursId).maybeSingle(),
    onglet === "questions" ? filsDeLaSeance(ctx.jeton, id) : Promise.resolve([]),
    onglet === "questions" ? dejaSignales(ctx.jeton) : Promise.resolve(new Set<string>()),
  ]);

  const salonLien =
    salon.data && (salon.data as { class_id: string | null }).class_id
      ? `/app/classes/${(salon.data as { class_id: string }).class_id}/salons/${(salon.data as { id: string }).id}`
      : null;

  return (
    <>
      <EnTetePage
        filAriane={[
          { href: "/app/cours", libelle: "Mes cours" },
          { href: `/app/cours/${seance.coursId}`, libelle: seance.matiere ?? "Cours" },
          ...(seance.chapitre ? [{ href: `/app/cours/${seance.coursId}`, libelle: seance.chapitre }] : []),
        ]}
        titre={seance.titre}
        sousTitre={seance.objectif}
      />

      <nav className="onglets-liens mb-6" aria-label="Sections de la séance">
        {ONGLETS.map((o) => (
          <Link key={o.cle} href={`/app/seances/${id}${o.cle === "cours" ? "" : `?onglet=${o.cle}`}`} aria-current={onglet === o.cle ? "page" : undefined}>
            {o.libelle}
            {o.cle === "exercices" && exercices.length > 0 ? ` (${exercices.length})` : ""}
          </Link>
        ))}
      </nav>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_320px]">
        <div className="min-w-0">
          {onglet === "cours" ? (
            <LectureSeance seance={id} salonQuestion={salonLien}>
              <article className="panneau lecture max-w-none">
                <p className="meta m-0 mb-4 flex flex-wrap items-center gap-2">
                  <FileText size={14} strokeWidth={1.75} aria-hidden="true" />
                  Source : {seance.matiere ?? "cours"}
                  {seance.versionNumero ? ` · version ${seance.versionNumero}` : ""}
                  {seance.publieeLe ? ` · publiée le ${dateLisible(seance.publieeLe)}` : ""}
                  {seance.etat !== "publiee" ? <Etiquette ton="attention">Aperçu enseignant — non publiée</Etiquette> : null}
                </p>
                {seance.document ? (
                  <RenduDocument document={seance.document.document} reglages={seance.document.reglages} />
                ) : null}
                {seance.blocs.length > 0 ? (
                  <VueSeance
                    seance={{
                      id: seance.id,
                      title: seance.titre,
                      objective: null,
                      state: seance.etat as "publiee",
                      scheduled_for: null,
                      published_at: seance.publieeLe,
                      updated_at: seance.majLe,
                      teaching_space_id: seance.coursId,
                      chapter_id: null,
                    }}
                    blocs={[...seance.blocs]}
                    libelleCours={seance.matiere ?? "Cours"}
                    sansEntete
                  />
                ) : null}
                {seance.document === null && seance.blocs.length === 0 ? (
                  <p className="m-0 text-[color:var(--color-encre-faible)]">Cette séance ne contient pas encore de contenu écrit.</p>
                ) : null}
              </article>
            </LectureSeance>
          ) : onglet === "exercices" ? (
            exercices.length === 0 ? (
              <EtatVide
                icone={Dumbbell}
                titre="Pas d'exercice publié pour cette séance"
                texte="Ton professeur n'a pas encore ajouté d'exercice ici. Study n'en invente pas : tu peux t'entraîner sur une autre séance, ou poser une question."
              />
            ) : (
              <Panneau titre="S'entraîner sur cette séance">
                <ol className="m-0 grid list-decimal gap-3 pl-5">
                  {exercices.map((e) => (
                    <li key={e.versionId}>
                      <p className="m-0 font-medium">{e.enonce}</p>
                      <p className="meta m-0 mt-1">
                        {e.kind === "qcm" ? "Choix multiple" : e.kind === "numerique" ? "Réponse numérique" : "Réponse rédigée"}
                        {e.notion ? ` · ${e.notion}` : ""} · version {e.version}
                      </p>
                    </li>
                  ))}
                </ol>
                <form action={sEntrainer} className="mt-5">
                  <input type="hidden" name="titre" value={seance.titre} />
                  {exercices.map((e) => (
                    <input key={e.versionId} type="hidden" name="version" value={e.versionId} />
                  ))}
                  <button type="submit" className="bouton bouton-primaire">
                    <Dumbbell {...ICONE} /> Commencer l&apos;entraînement
                  </button>
                </form>
              </Panneau>
            )
          ) : (
            <div className="grid gap-4">
              {salonLien ? (
                <div className="panneau flex flex-wrap items-center justify-between gap-3">
                  <p className="m-0">Ta question peut aider toute la classe : pose-la dans le salon de la matière, la séance sera citée.</p>
                  <Link href={`${salonLien}?seance=${id}`} className="bouton bouton-secondaire">
                    <MessageCircleQuestion {...ICONE} /> Demander au salon
                  </Link>
                </div>
              ) : null}
              <Entraide seance={id} fils={fils} moi={ctx.personne.profileId} signales={[...signales]} />
            </div>
          )}
        </div>

        <aside className="grid content-start gap-4" aria-label="Outils de la séance">
          <section className="panneau">
            <h2 className="titre-bloc mb-3">Outils</h2>
            <div className="grid gap-2">
              <Link href={`/app/fiches/nouvelle?seance=${id}`} className="bouton bouton-primaire justify-between">
                <span className="inline-flex items-center gap-2">
                  <Sparkles {...ICONE} /> Créer ma fiche
                </span>
                <span aria-hidden="true">›</span>
              </Link>
              <Link href={`/app/aide?seance=${id}`} className="bouton bouton-secondaire justify-start">
                <HandHelping {...ICONE} /> Débloque-moi
              </Link>
              {exercices.length > 0 ? (
                <Link href={`/app/seances/${id}?onglet=exercices`} className="bouton bouton-secondaire justify-start">
                  <Dumbbell {...ICONE} /> M&apos;entraîner
                </Link>
              ) : null}
              {ctx.roles.eleve ? (
                <form action={basculerRepere}>
                  <input type="hidden" name="seance" value={id} />
                  <input type="hidden" name="kind" value="a_revoir" />
                  <input type="hidden" name="actif" value={reperes.aRevoir ? "non" : "oui"} />
                  <button type="submit" className="bouton bouton-discret w-full justify-start" aria-pressed={reperes.aRevoir}>
                    {reperes.aRevoir ? <BookmarkCheck {...ICONE} /> : <Bookmark {...ICONE} />}
                    {reperes.aRevoir ? "Marquée à revoir" : "Marquer à revoir"}
                  </button>
                </form>
              ) : null}
            </div>
          </section>
          {ctx.roles.eleve ? (
            <section className="panneau">
              <NotePrivee seance={id} initiale={note.corps} revision={note.revision} />
              <p className="meta m-0 mt-3">Ni tes professeurs ni l&apos;administration ne lisent cette note.</p>
            </section>
          ) : null}
        </aside>
      </div>
    </>
  );
}
