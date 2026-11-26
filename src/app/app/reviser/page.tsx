import { contexteApp } from "@/lib/v6/contexte";
import { mesFiches } from "@/lib/v6/fiches";
import { maProgression } from "@/lib/v6/progression";
import { maSemaine } from "@/lib/v6/semaine";
import { suggestionsDeRevision } from "@/lib/v6/revision";
import { VueReviser } from "./vue";
import Link from "next/link";
import { revisionsDesDevoirs } from "@/lib/revision/devoirs";
import { entrainementsParMatiere } from "@/lib/revision/entrainements-matieres";
import { lancerEntrainement, lancerRevisionDevoir } from "./actions";
import { coursDeLEleve } from "@/lib/espace-eleve";
import { EnTetePage, ICONE } from "@/components/study/ui";
import { LifeBuoy, NotebookText } from "lucide-react";

export const metadata = { title: "Réviser" };
export const dynamic = "force-dynamic";

/**
 * A06 — Réviser (maquettes R2 n° 1 et 3) : d'abord ce qui est dû (les
 * suggestions calculées par le serveur), puis les activités, puis les fiches
 * de l'élève. Aucune note, aucun classement : des repères pour soi.
 */
export default async function PageReviser({ searchParams }: { searchParams: Promise<{ erreur?: string }> }) {
  const ctx = await contexteApp();
  const { erreur } = await searchParams;
  const [fiches, priorites, progression, semaine, recommandations, matieres] = await Promise.all([
    mesFiches(ctx.jeton),
    suggestionsDeRevision(ctx.jeton, { limite: 24 }),
    maProgression(ctx.jeton, ctx.personne.profileId),
    maSemaine(ctx.jeton, ctx.personne.profileId),
    revisionsDesDevoirs(ctx.jeton),
    coursDeLEleve(ctx.jeton),
  ]);

  const recommandation = recommandations?.find(r => r.versions.length > 0);
  const entrainements = entrainementsParMatiere(matieres, priorites.suggestions, recommandations ?? []);
  return <div className="mx-auto max-w-[1100px]">
    <EnTetePage
      sourcil="Réviser"
      titre="Qu'est-ce que tu veux travailler ?"
      sousTitre="Choisis ta matière, puis avance avec les exercices de tes professeurs."
      actions={<>
        <Link href="/app/erreurs" className="bouton bouton-secondaire"><NotebookText {...ICONE} /> Carnet d&apos;erreurs</Link>
        <Link href="/app/aide" className="bouton bouton-secondaire"><LifeBuoy {...ICONE} /> Besoin d&apos;aide</Link>
      </>}
    />
    {erreur ? <p role="alert" className="mb-4 rounded-xl bg-[color:var(--color-erreur-fond)] p-4 text-[color:var(--color-erreur)]">{erreur === "aucun-exercice" ? "Aucun exercice disponible pour cet entraînement." : "L'entraînement n'a pas pu être ouvert."}</p> : null}
    {recommandations === null ? <p role="status">Les révisions liées aux devoirs sont momentanément indisponibles. Tes cours restent accessibles.</p> : null}
    {recommandation ? <section className="panneau mb-6" aria-label="Préparer mon devoir">
      <h2 className="titre-section">Préparer {recommandation.titre}</h2>
      <p>{recommandation.notion} · {Math.min(3, recommandation.versions.length)} exercices · environ {Math.min(3, recommandation.versions.length) * 2} min</p>
      <p>{matieres.find(m => m.id === recommandation.espace_id)?.libelle}</p>
      {recommandation.echeance ? <p>À rendre le {new Intl.DateTimeFormat("fr-FR", { dateStyle: "medium", timeZone: "Europe/Paris" }).format(new Date(recommandation.echeance))}</p> : null}
      <Link href={`/app/devoirs/${recommandation.devoir_id}`}>Voir le devoir</Link>
      <form action={lancerRevisionDevoir} className="mt-4">
        <input type="hidden" name="devoir" value={recommandation.devoir_id} />
        <input type="hidden" name="notion" value={recommandation.notion_id} />
        <button className="bouton bouton-primaire">Commencer</button>
      </form>
    </section> : null}
    <section className="mb-8" aria-labelledby="reviser-par-matiere">
      <div className="mb-4">
        <span className="text-sm font-bold text-[color:var(--color-accent)]">À partir de tes vrais cours</span>
        <h2 id="reviser-par-matiere" className="mb-1 mt-1 text-2xl font-bold">Choisis ce que tu veux réviser</h2>
        <p className="m-0 max-w-2xl text-sm leading-6 text-[color:var(--color-encre-faible)]">Les exercices viennent de ce que tes professeurs ont publié et de tes devoirs. Quand plusieurs notions sont disponibles, la séance les mélange.</p>
      </div>
      {entrainements.length === 0 ? <p className="encadre" data-ton="neutre">Tu retrouveras tes matières ici dès que tu auras rejoint une classe.</p> : null}
      <ul className="m-0 grid list-none gap-3 p-0 sm:grid-cols-2">
        {entrainements.map(m => <li key={m.id} className="flex min-w-0 flex-col rounded-2xl border border-[color:var(--color-bordure)] bg-[color:var(--color-surface)] p-5 sm:p-6">
          <div className="flex min-w-0 items-start justify-between gap-3">
            <h3 className="m-0 min-w-0 break-words text-lg font-bold">{m.libelle}</h3>
            {m.versions.length > 0 ? <span className="shrink-0 rounded-full bg-[color:var(--color-rose-clair)] px-2.5 py-1 text-xs font-bold text-[color:var(--color-accent)]">{m.versions.length} exercices</span> : null}
          </div>
          {m.versions.length > 0 ? (
            <>
              <p className="mb-1 mt-3 text-sm leading-6 text-[color:var(--color-encre-faible)]">{m.devoirs > 0 ? "En lien avec tes devoirs et tes révisions." : "Pour retravailler les notions de ton cours."}</p>
              {m.notions.length > 0 ? <p className="mb-4 mt-1 text-sm font-medium leading-6">{m.notions.join(" · ")}</p> : null}
              <form action={lancerEntrainement} className="mt-auto">
                <input type="hidden" name="titre" value={`Réviser ${m.libelle}`} />
                {m.versions.map((version) => <input key={version} type="hidden" name="version" value={version} />)}
                <button type="submit" className="bouton bouton-primaire w-full min-w-0 whitespace-normal py-3 leading-5">Lancer ma révision · {m.versions.length} questions</button>
              </form>
            </>
          ) : (
            <p className="mb-4 mt-3 flex-1 text-sm leading-6 text-[color:var(--color-encre-faible)]">Aucun exercice publié pour le moment. Tu peux quand même relire les séances de cette matière.</p>
          )}
          <Link href={`/app/cours/${m.id}`} className="mt-3 inline-flex min-h-10 items-center text-sm font-bold text-[color:var(--color-accent)]">Voir mon cours</Link>
        </li>)}
      </ul>
    </section>
    <VueReviser afficherEntete={false} fiches={fiches} priorites={priorites} progression={progression} semaine={semaine} />
  </div>;
}
