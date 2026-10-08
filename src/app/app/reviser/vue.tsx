import Link from "next/link";
import { BookOpen, ClipboardCheck, FileText, Layers, LifeBuoy, Lightbulb, NotebookText, Sparkles, Target } from "lucide-react";
import { EnTetePage, Etiquette, EtatVide, ICONE, Ligne, ListeLignes, TuileIcone, dateLisible } from "@/components/study/ui";
import { ETATS_FICHE, FORMATS, type mesFiches } from "@/lib/v6/fiches";
import { LIBELLE_STATUT, type suggestionsDeRevision } from "@/lib/v6/revision";
import { lancerEntrainement } from "./actions";

const ACTIVITES = [
  { format: "essentiel", titre: "L'essentiel", texte: "Relire les notions clés du cours", icone: BookOpen },
  { format: "detaille", titre: "Comprendre", texte: "Les passages complets, cités", icone: Lightbulb },
  { format: "cartes", titre: "Cartes mémoire", texte: "Réviser en se testant", icone: Layers },
  { format: "quiz", titre: "Me tester", texte: "Les exercices de ton professeur", icone: Target },
] as const;

/** Vue de la page, rendue avec des données réelles (page.tsx) ou fictives (aperçu de développement). */
export function VueReviser({ erreur, fiches, priorites }: { erreur?: string; fiches: Awaited<ReturnType<typeof mesFiches>>; priorites: Awaited<ReturnType<typeof suggestionsDeRevision>> }) {
  return (
    <div className="mx-auto max-w-[1100px]">
      <EnTetePage
        sourcil="Réviser"
        titre="Un peu chaque jour."
        sousTitre="Des fiches tirées de tes cours, les exercices de tes professeurs et ton carnet d'erreurs."
        actions={
          <>
            <Link href="/app/erreurs" className="bouton bouton-secondaire">
              <NotebookText {...ICONE} /> Carnet d&apos;erreurs
            </Link>
            <Link href="/app/aide" className="bouton bouton-secondaire">
              <LifeBuoy {...ICONE} /> Débloque-moi
            </Link>
          </>
        }
      />
      {erreur ? (
        <p role="alert" className="mb-4 rounded-[10px] bg-[color:var(--color-erreur-fond)] p-3 text-[color:var(--color-erreur)]">
          {erreur === "aucun-exercice" ? "Aucun exercice disponible pour cet entraînement." : "L'entraînement n'a pas pu être ouvert."}
        </p>
      ) : null}

      <section aria-labelledby="dues" className="mb-8">
        <h2 id="dues" className="titre-section mb-3">
          À revoir en premier
        </h2>
        {priorites.suggestions.length === 0 ? (
          <div className="encadre" data-ton="neutre">
            <p className="m-0 text-[color:var(--color-encre-faible)]">
              Rien à proposer pour l&apos;instant : les suggestions apparaissent quand tes professeurs publient des exercices rattachés à des notions.
            </p>
          </div>
        ) : (
          <ListeLignes>
            {priorites.suggestions.map((s) => (
              <li key={s.notionId}>
                <div className="ligne-r2 flex-wrap">
                  <TuileIcone icone={Target} />
                  <span className="min-w-0 flex-1">
                    <span className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold">{s.notion}</span>
                      <Etiquette ton={s.statut === "a_revoir" ? "attention" : "neutre"}>{LIBELLE_STATUT[s.statut] ?? s.statut}</Etiquette>
                    </span>
                    <span className="meta block">
                      {s.cours} · {s.explication}
                    </span>
                  </span>
                  <form action={lancerEntrainement}>
                    <input type="hidden" name="titre" value={s.notion} />
                    {s.versions.map((v) => (
                      <input key={v} type="hidden" name="version" value={v} />
                    ))}
                    <button type="submit" className="bouton bouton-primaire bouton-compact">
                      S&apos;entraîner ({s.versions.length})
                    </button>
                  </form>
                </div>
              </li>
            ))}
          </ListeLignes>
        )}
        <p className="meta m-0 mt-3">
          Ces propositions combinent les contrôles annoncés, tes réponses récentes et les révisions prévues. Une notion n&apos;est « consolidée »
          qu&apos;après trois réussites sans aide, sur deux jours et deux exercices différents.
        </p>
      </section>

      <section aria-labelledby="activites" className="mb-8">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-3">
          <h2 id="activites" className="titre-section">
            Créer une révision
          </h2>
          <Link href="/app/fiches/nouvelle?format=controle" className="bouton bouton-secondaire bouton-compact">
            <ClipboardCheck {...ICONE} /> Préparer un contrôle
          </Link>
        </div>
        <ul className="m-0 grid list-none gap-3 p-0 sm:grid-cols-2 lg:grid-cols-4">
          {ACTIVITES.map((a) => (
            <li key={a.format}>
              <Link href={`/app/fiches/nouvelle?format=${a.format}`} className="carte-chiffre min-h-0">
                <TuileIcone icone={a.icone} />
                <span className="font-bold">{a.titre}</span>
                <span className="meta">{a.texte}</span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section aria-labelledby="fiches">
        <h2 id="fiches" className="titre-section mb-3">
          Mes fiches
        </h2>
        {fiches === null ? (
          <p className="m-0 text-[color:var(--color-erreur)]">Tes fiches n&apos;ont pas pu être chargées.</p>
        ) : fiches.length === 0 ? (
          <EtatVide icone={Sparkles} titre="Aucune fiche pour l'instant" texte="Crée ta première fiche à partir d'une séance : chaque phrase y renvoie au passage du cours d'où elle vient." />
        ) : (
          <ListeLignes>
            {fiches.map((f) => (
              <Ligne
                key={f.id}
                href={`/app/fiches/${f.id}`}
                icone={FileText}
                titre={f.titre}
                detail={`${FORMATS[f.format]?.libelle ?? f.format} · ${dateLisible(f.majLe, { day: "numeric", month: "short" })}`}
                fin={<Etiquette ton={ETATS_FICHE[f.etat]?.ton ?? "neutre"}>{ETATS_FICHE[f.etat]?.libelle ?? f.etat}</Etiquette>}
              />
            ))}
          </ListeLignes>
        )}
      </section>
    </div>
  );
}
