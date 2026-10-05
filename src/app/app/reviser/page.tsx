import Link from "next/link";
import { BookOpen, ChevronRight, ClipboardCheck, Layers, Lightbulb, NotebookText, Sparkles, Target } from "lucide-react";
import { EnTetePage, Etiquette, EtatVide, ICONE, Panneau, dateLisible } from "@/components/study/ui";
import { contexteApp } from "@/lib/v6/contexte";
import { ETATS_FICHE, FORMATS, mesFiches } from "@/lib/v6/fiches";
import { LIBELLE_STATUT, suggestionsDeRevision } from "@/lib/v6/revision";
import { lancerEntrainement } from "./actions";

export const metadata = { title: "Réviser" };
export const dynamic = "force-dynamic";

const ACTIVITES = [
  { format: "essentiel", titre: "L'essentiel", texte: "Relire les notions clés du cours", icone: BookOpen },
  { format: "detaille", titre: "Comprendre", texte: "Les passages complets, cités", icone: Lightbulb },
  { format: "cartes", titre: "Cartes mémoire", texte: "Réviser en se testant", icone: Layers },
  { format: "quiz", titre: "Me tester", texte: "Les exercices de ton professeur", icone: Target },
] as const;

/**
 * Réviser — choisir une activité, voir pourquoi une révision est proposée,
 * retrouver ses fiches. Aucune note, aucun classement : des repères pour soi.
 */
export default async function PageReviser({ searchParams }: { searchParams: Promise<{ erreur?: string }> }) {
  const ctx = await contexteApp();
  const { erreur } = await searchParams;
  const [fiches, priorites] = await Promise.all([mesFiches(ctx.jeton), suggestionsDeRevision(ctx.jeton, { limite: 5 })]);

  return (
    <>
      <EnTetePage
        titre="Réviser"
        sousTitre="Des fiches tirées de tes cours, des exercices de tes professeurs, et ton carnet d'erreurs."
        actions={
          <>
            <Link href="/app/erreurs" className="bouton bouton-secondaire">
              <NotebookText {...ICONE} /> Mon carnet d&apos;erreurs
            </Link>
            <Link href="/app/aide" className="bouton bouton-secondaire">
              Débloque-moi
            </Link>
          </>
        }
      />
      {erreur ? (
        <p role="alert" className="mb-4 rounded-[10px] bg-[color:var(--color-erreur-fond)] p-3 text-[color:var(--color-erreur)]">
          {erreur === "aucun-exercice" ? "Aucun exercice disponible pour cet entraînement." : "L'entraînement n'a pas pu être ouvert."}
        </p>
      ) : null}

      <section aria-labelledby="activites" className="mb-8">
        <h2 id="activites" className="titre-section mb-4">
          Choisir une activité
        </h2>
        <ul className="m-0 grid list-none gap-4 p-0 sm:grid-cols-2 lg:grid-cols-4">
          {ACTIVITES.map((a) => (
            <li key={a.format}>
              <Link href={`/app/fiches/nouvelle?format=${a.format}`} className="panneau panneau-rose flex h-full flex-col no-underline">
                <a.icone size={28} strokeWidth={1.75} aria-hidden="true" className="text-[color:var(--color-accent)]" />
                <span className="titre-bloc mt-4 font-bold text-[color:var(--color-encre)]">{a.titre}</span>
                <span className="meta mt-1 flex items-center justify-between gap-2 text-[color:var(--color-accent-fonce)]">
                  {a.texte} <ChevronRight size={16} strokeWidth={1.75} aria-hidden="true" />
                </span>
              </Link>
            </li>
          ))}
        </ul>
        <Link href="/app/fiches/nouvelle?format=controle" className="bouton bouton-primaire mt-4">
          <ClipboardCheck {...ICONE} /> Préparer un contrôle
        </Link>
      </section>

      <div className="grid gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <Panneau id="fiches" titre="Mes fiches">
          {fiches === null ? (
            <p className="m-0 text-[color:var(--color-erreur)]">Tes fiches n&apos;ont pas pu être chargées.</p>
          ) : fiches.length === 0 ? (
            <EtatVide icone={Sparkles} titre="Aucune fiche pour l'instant" texte="Crée ta première fiche à partir d'une séance : chaque phrase y renvoie au passage du cours d'où elle vient." />
          ) : (
            <ul className="m-0 list-none p-0">
              {fiches.map((f) => (
                <li key={f.id} className="ligne">
                  <Link href={`/app/fiches/${f.id}`} className="min-w-0 flex-1 no-underline">
                    <span className="block truncate font-semibold text-[color:var(--color-encre)]">{f.titre}</span>
                    <span className="meta">
                      {FORMATS[f.format]?.libelle ?? f.format} · {dateLisible(f.majLe, { day: "numeric", month: "short" })}
                    </span>
                  </Link>
                  <Etiquette ton={ETATS_FICHE[f.etat]?.ton ?? "neutre"}>{ETATS_FICHE[f.etat]?.libelle ?? f.etat}</Etiquette>
                </li>
              ))}
            </ul>
          )}
        </Panneau>

        <Panneau id="suggestions" titre="Révisions proposées">
          {priorites.suggestions.length === 0 ? (
            <p className="m-0 text-[color:var(--color-encre-faible)]">
              Rien à proposer pour l&apos;instant : les suggestions apparaissent quand tes professeurs publient des exercices rattachés à des
              notions.
            </p>
          ) : (
            <ul className="m-0 list-none p-0">
              {priorites.suggestions.map((s) => (
                <li key={s.notionId} className="ligne block">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="font-semibold">{s.notion}</span>
                    <Etiquette ton={s.statut === "a_revoir" ? "attention" : "neutre"}>{LIBELLE_STATUT[s.statut] ?? s.statut}</Etiquette>
                  </div>
                  <p className="meta m-0 mt-1">
                    {s.cours} · {s.explication}
                  </p>
                  <form action={lancerEntrainement} className="mt-2">
                    <input type="hidden" name="titre" value={s.notion} />
                    {s.versions.map((v) => (
                      <input key={v} type="hidden" name="version" value={v} />
                    ))}
                    <button type="submit" className="bouton bouton-secondaire bouton-compact">
                      S&apos;entraîner ({s.versions.length})
                    </button>
                  </form>
                </li>
              ))}
            </ul>
          )}
          <p className="meta m-0 mt-4">
            Ces propositions combinent les contrôles annoncés, tes réponses récentes et les révisions prévues. Ce sont des repères, pas une
            note ; une notion n&apos;est « consolidée » qu&apos;après trois réussites sans aide, sur deux jours et deux exercices différents.
          </p>
        </Panneau>
      </div>
    </>
  );
}
