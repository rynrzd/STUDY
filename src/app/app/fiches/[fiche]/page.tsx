import Link from "next/link";
import { AlertTriangle, CheckCircle2, Circle, Layers, Loader, Share2, Target } from "lucide-react";
import { Actualisation, BoutonImprimer } from "@/components/study/Actualisation";
import { AccesIndisponible, EnTetePage, Etiquette, ICONE, Panneau, dateLisible } from "@/components/study/ui";
import { contexteApp } from "@/lib/v6/contexte";
import { ETATS_FICHE, FORMATS, lireFiche } from "@/lib/v6/fiches";
import { annulerFiche, lancerEntrainement } from "../../reviser/actions";
import { EditionFiche } from "./EditionFiche";

export const metadata = { title: "Fiche" };
export const dynamic = "force-dynamic";

const ETAPES = ["Lecture des sources", "Vérification des accès", "Assemblage des extraits"] as const;

/**
 * E05 et E40 — une fiche et sa préparation. Pendant le travail : les étapes
 * réelles, sans pourcentage inventé, et l'annulation. Ensuite : chaque
 * extrait renvoie au passage exact ; l'état « généré, à vérifier » et les
 * limites sont visibles ; une source retirée bloque l'affichage, une source
 * modifiée est signalée sans réécrire la fiche.
 */
export default async function PageFiche({ params, searchParams }: { params: Promise<{ fiche: string }>; searchParams: Promise<{ modifier?: string }> }) {
  const ctx = await contexteApp();
  const { fiche: id } = await params;
  const { modifier } = await searchParams;
  const fiche = await lireFiche(ctx.jeton, id);
  if (fiche === null) return <AccesIndisponible retour="/app/reviser" />;

  const enCours = fiche.etat === "queued" || fiche.etat === "processing";
  const titres = new Map(fiche.sources.filter((s) => s.lesson_id).map((s) => [s.lesson_id!, s.titre ?? "Séance"]));
  const classe = ctx.classeActive?.classe;

  return (
    <div className="mx-auto max-w-[1100px]">
      <EnTetePage
        filAriane={[{ href: "/app/reviser", libelle: "Réviser" }]}
        sourcil={FORMATS[fiche.format]?.libelle ?? "Fiche"}
        titre={fiche.titre}
        actions={
          fiche.etat === "ready" && fiche.sourcesLisibles ? (
            <>
              <BoutonImprimer />
              {fiche.sections && fiche.sections.length > 0 && modifier !== "1" ? (
                <Link href={`/app/fiches/${id}?modifier=1`} className="bouton bouton-secondaire">
                  Modifier
                </Link>
              ) : null}
            </>
          ) : null
        }
      />

      {enCours ? (
        <Panneau titre="Préparation en cours">
          <ol className="m-0 grid list-none gap-3 p-0">
            {ETAPES.map((e, i) => {
              const fait = fiche.etat === "processing" && i < 2;
              const courant = (fiche.etat === "queued" && i === 0) || (fiche.etat === "processing" && i === 2);
              return (
                <li key={e} className="flex items-center gap-3">
                  {fait ? (
                    <CheckCircle2 {...ICONE} className="text-[color:var(--color-succes)]" />
                  ) : courant ? (
                    <Loader {...ICONE} className="animate-spin text-[color:var(--color-accent)] motion-reduce:animate-none" />
                  ) : (
                    <Circle {...ICONE} className="text-[color:var(--color-bordure-forte)]" />
                  )}
                  <span className={courant ? "font-semibold" : ""}>{e}</span>
                </li>
              );
            })}
          </ol>
          <p className="meta m-0 mt-4">État : {ETATS_FICHE[fiche.etat]?.libelle}. Sources : {[...titres.values()].join(", ")}.</p>
          <Actualisation actif />
          <form action={annulerFiche} className="mt-4">
            <input type="hidden" name="fiche" value={id} />
            <button type="submit" className="bouton bouton-discret">
              Annuler la préparation
            </button>
          </form>
        </Panneau>
      ) : null}

      {!enCours ? (
        <div className="grid gap-6 lg:grid-cols-[minmax(0,1fr)_300px]">
          <article className="grid content-start gap-5">
            {!fiche.sourcesLisibles ? (
              <div role="alert" className="panneau border-[color:var(--color-erreur-fond)] bg-[color:var(--color-erreur-fond)]">
                <p className="m-0 font-semibold text-[color:var(--color-erreur)]">Une source n&apos;est plus accessible</p>
                <p className="m-0 mt-1">
                  Une séance utilisée par cette fiche a été retirée ou ne fait plus partie de tes cours. Son contenu n&apos;est donc plus
                  affiché ici.
                </p>
              </div>
            ) : null}
            {fiche.etat === "failed" ? (
              <div role="alert" className="panneau">
                <p className="m-0 font-semibold">Cette fiche n&apos;a pas pu être préparée.</p>
                <p className="m-0 mt-1 text-[color:var(--color-encre-faible)]">
                  {fiche.erreur === "SOURCE_REVOKED"
                    ? "Une source a été retirée pendant la préparation : rien n'a été conservé."
                    : "Le service n'a pas abouti. Aucun contenu approximatif n'a été produit à la place."}
                </p>
                <Link href="/app/fiches/nouvelle" className="bouton bouton-secondaire mt-4">
                  Recommencer
                </Link>
              </div>
            ) : null}
            {fiche.etat === "canceled" ? <p className="panneau m-0">Préparation annulée.</p> : null}
            {fiche.sourceModifiee ? (
              <div className="panneau border-[color:var(--color-attention-fond)] bg-[color:var(--color-attention-fond)]">
                <p className="m-0 flex items-center gap-2 font-semibold text-[color:var(--color-attention)]">
                  <AlertTriangle {...ICONE} /> Source mise à jour
                </p>
                <p className="m-0 mt-1">
                  Ton professeur a modifié une séance depuis la préparation de cette fiche. Ta fiche n&apos;a pas été réécrite.{" "}
                  <Link href={`/app/fiches/nouvelle?format=${fiche.format}${fiche.sources[0]?.lesson_id ? `&seance=${fiche.sources[0].lesson_id}` : ""}`}>
                    Préparer une nouvelle version
                  </Link>
                </p>
              </div>
            ) : null}
            {fiche.limites.length > 0 ? (
              <div className="panneau">
                <p className="m-0 font-semibold">Limites de cette fiche</p>
                <ul className="m-0 mt-2 grid gap-1 pl-5 text-[0.875rem]">
                  {fiche.limites.map((l, i) => (
                    <li key={i}>{l.message}</li>
                  ))}
                </ul>
              </div>
            ) : null}

            {modifier === "1" && fiche.sections ? (
              <EditionFiche fiche={id} version={fiche.version} sections={fiche.sections} />
            ) : (
              fiche.sections?.map((s, i) => (
                <section key={i} className="panneau">
                  <h2 className="titre-section mb-3">{s.titre}</h2>
                  <ul className="m-0 grid list-none gap-3 p-0">
                    {s.extraits.map((e, j) => (
                      <li key={j} className="lecture border-l-2 border-[color:var(--color-rose-decor)] pl-4">
                        <p className="m-0">{e.texte}</p>
                        <Link
                          href={`/app/seances/${e.citation.lessonId}${e.citation.ref.startsWith("bloc:") ? `#${e.citation.ref.replace(":", "-")}` : ""}`}
                          className="meta no-underline"
                        >
                          Source : {titres.get(e.citation.lessonId) ?? "séance"}
                          {e.citation.page ? `, page ${e.citation.page}` : ""}
                        </Link>
                      </li>
                    ))}
                  </ul>
                </section>
              ))
            )}

            {fiche.cartes && fiche.cartes.length > 0 ? (
              <Panneau titre={`${fiche.cartes.length} cartes mémoire`}>
                <p className="m-0 text-[color:var(--color-encre-faible)]">Chaque réponse est un extrait du cours.</p>
                <Link href={`/app/cartes/${id}`} className="bouton bouton-primaire mt-4">
                  <Layers {...ICONE} /> Réviser les cartes
                </Link>
              </Panneau>
            ) : null}
            {fiche.exercices && fiche.exercices.length > 0 ? (
              <Panneau titre={`${fiche.exercices.length} exercice${fiche.exercices.length > 1 ? "s" : ""} de ton professeur`}>
                <form action={lancerEntrainement}>
                  <input type="hidden" name="titre" value={fiche.titre} />
                  <input type="hidden" name="fiche" value={id} />
                  {fiche.exercices.map((v) => (
                    <input key={v} type="hidden" name="version" value={v} />
                  ))}
                  <button type="submit" className="bouton bouton-primaire">
                    <Target {...ICONE} /> Commencer
                  </button>
                </form>
              </Panneau>
            ) : null}
          </article>

          <aside className="grid content-start gap-4 app-sans-impression" aria-label="État de la fiche">
            <section className="panneau">
              <h2 className="titre-bloc mb-3">État</h2>
              <div className="flex flex-wrap gap-2">
                <Etiquette ton={ETATS_FICHE[fiche.etat]?.ton ?? "neutre"}>{ETATS_FICHE[fiche.etat]?.libelle ?? fiche.etat}</Etiquette>
                <Etiquette ton="attention">Généré, à vérifier</Etiquette>
              </div>
              <p className="meta m-0 mt-3">
                Assemblée le {dateLisible(fiche.creeLe, { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })} · version {fiche.version}
                · méthode « {fiche.generateurVersion} » (extraits du cours, sans modèle génératif).
              </p>
              <p className="meta m-0 mt-2">Aucun professeur n&apos;a validé cette fiche. Une citation montre d&apos;où vient un passage ; elle ne prouve pas qu&apos;il est bien compris.</p>
            </section>
            <section className="panneau">
              <h2 className="titre-bloc mb-2">Sources</h2>
              <ul className="m-0 grid gap-1 pl-5 text-[0.875rem]">
                {fiche.sources.map((s, i) =>
                  s.retiree ? (
                    <li key={i} className="text-[color:var(--color-encre-faible)]">Source retirée</li>
                  ) : (
                    <li key={i}>
                      <Link href={`/app/seances/${s.lesson_id}`}>{s.titre}</Link>
                    </li>
                  ),
                )}
              </ul>
            </section>
            {fiche.etat === "ready" && fiche.sourcesLisibles && classe ? (
              <Link href={`/app/classes/${classe}/bibliotheque?fiche=${id}&titre=${encodeURIComponent(fiche.titre)}`} className="bouton bouton-secondaire">
                <Share2 {...ICONE} /> Proposer à la classe
              </Link>
            ) : null}
          </aside>
        </div>
      ) : null}
    </div>
  );
}
