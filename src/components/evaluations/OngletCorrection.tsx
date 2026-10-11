import Link from "next/link";
import { CheckCircle2, CircleDashed, CircleDot, XCircle } from "lucide-react";
import { saisirReponse } from "@/app/professeur/evaluations/actions";
import { NoteQuestion } from "@/components/evaluations/FormulairesProf";
import { texteAttendu, texteReponse } from "@/components/evaluations/ReponseLisible";
import { Encadre, Etiquette } from "@/components/study/ui";
import { texteModele } from "@/lib/evaluations/analyse";
import { CORRECTION_AUTOMATIQUE, LIBELLES_GENRE } from "@/lib/evaluations/sujet";
import { cleCQ, type EvaluationProf, type Suivi } from "@/lib/v6/evaluations";

const lettre = (i: number) => String.fromCharCode(65 + i);

/**
 * Onglet « Correction » : une question à la fois, pour toute la classe.
 * Corriger la question 3 de trente copies d'affilée va plus vite et plus
 * juste que trente copies une à une. Sur papier, la réponse se saisit en un
 * clic (QCM, vrai/faux) et se corrige aussitôt.
 */
export function OngletCorrection({ prof, suivi, questionId }: { prof: EvaluationProf; suivi: Suivi; questionId: string | null }) {
  const e = prof.evaluation;
  if (!e.distribueeLe) return <Encadre titre="Rien à corriger pour l'instant">Distribuez l&apos;évaluation : les copies apparaîtront ici.</Encadre>;
  const question = prof.questions.find((q) => q.id === questionId) ?? prof.questions[0];
  if (!question) return null;
  const stats = new Map(suivi.analyse.questions.map((q) => [q.id, q]));
  const papier = e.support === "papier";
  const publiee = e.resultatsPubliesLe !== null;
  const noms = new Map(suivi.eleves.map((x) => [x.profileId, `${x.nom} ${x.prenom}`]));
  const copies = [...suivi.copies]
    .filter((c) => papier || c.rendueLe || c.commenceeLe)
    .sort((a, b) => (noms.get(a.profileId) ?? "").localeCompare(noms.get(b.profileId) ?? "", "fr"));

  return (
    <div className="grid gap-6 lg:grid-cols-[260px_minmax(0,1fr)]">
      <nav aria-label="Questions à corriger" className="grid min-w-0 content-start gap-1">
        {prof.questions.map((q) => {
          const s = stats.get(q.id);
          const reste = s?.aCorriger ?? 0;
          return (
            <Link
              key={q.id}
              href={`?onglet=correction&question=${q.id}`}
              aria-current={q.id === question.id ? "page" : undefined}
              className={`flex min-w-0 items-center justify-between gap-2 rounded-[var(--rayon-s)] border-l-[3px] px-3 py-2 no-underline ${q.id === question.id ? "border-l-[color:var(--color-accent)] bg-[color:var(--color-surface-douce)] font-bold" : "border-l-transparent hover:bg-[color:var(--color-survol)]"}`}
            >
              <span className="min-w-0 truncate">
                {q.ordre}. {texteModele(q.enonce)}
              </span>
              {reste > 0 ? <Etiquette ton="erreur">{reste}</Etiquette> : <CheckCircle2 size={16} aria-label="Tout corrigé" className="shrink-0 text-[color:var(--color-succes)]" />}
            </Link>
          );
        })}
      </nav>

      <section aria-labelledby="question-courante" className="panneau">
        <p className="meta m-0">
          Question {question.ordre} · {LIBELLES_GENRE[question.kind]} · {String(question.points).replace(".", ",")} pt
          {question.notion ? ` · ${question.notion}` : ""}
        </p>
        <h2 id="question-courante" className="titre-bloc m-0 mt-1 font-bold">
          {texteModele(question.enonce)}
        </h2>
        {question.criteres ? <p className="m-0 mt-2 border-l-[3px] border-l-[color:var(--color-accent)] pl-3 text-[0.9375rem]">Critères : {question.criteres}</p> : null}
        {CORRECTION_AUTOMATIQUE.has(question.kind) ? <p className="meta m-0 mt-2">Corrigée automatiquement ; vous pouvez changer les points d&apos;une copie.</p> : null}

        <ul className="m-0 mt-5 grid list-none gap-3 p-0">
          {copies.length === 0 ? <li className="meta">Aucune copie rendue pour l&apos;instant.</li> : null}
          {copies.map((c) => {
            const item = c.sujet.find((s) => s.question_id === question.id);
            if (!item) return null;
            const k = cleCQ(c.id, question.id);
            const reponse = suivi.reponses.get(k);
            const correction = suivi.corrections.get(k);
            const attendu = suivi.attendus.get(k)?.attendu;
            // Points partiels : ni juste ni faux, et l'icône le dit.
            const Icone = !correction ? CircleDashed : correction.juste ? CheckCircle2 : correction.points > 0 ? CircleDot : XCircle;
            return (
              <li key={c.id} className="rounded-[var(--rayon-l)] border border-[color:var(--color-bordure)] p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <p className="m-0 font-semibold">{noms.get(c.profileId) ?? "Élève"}</p>
                  <span className="inline-flex items-center gap-1 text-[0.875rem] font-semibold">
                    <Icone
                      size={16}
                      aria-hidden="true"
                      className={!correction ? "text-[color:var(--color-encre-faible)]" : correction.juste ? "text-[color:var(--color-succes)]" : correction.points > 0 ? "text-[color:var(--color-attention)]" : "text-[color:var(--color-erreur)]"}
                    />
                    {correction ? `${String(correction.points).replace(".", ",")} / ${String(question.points).replace(".", ",")}` : "À corriger"}
                  </span>
                </div>
                {item.enonce !== question.enonce ? <p className="meta m-0 mt-1">Son sujet : {item.enonce}</p> : null}
                <p className="m-0 mt-2 whitespace-pre-wrap rounded-[var(--rayon-m)] bg-[color:var(--color-survol)] p-3">{texteReponse(item, reponse)}</p>
                {attendu && question.kind !== "redigee" ? <p className="meta m-0 mt-1">Attendu sur son sujet : {texteAttendu(item, attendu)}</p> : null}

                {papier && !publiee && (question.kind === "qcm" || question.kind === "vrai_faux") ? (
                  <div className="mt-3 flex flex-wrap items-center gap-2" aria-label="Saisir la réponse cochée sur la copie">
                    <span className="meta">Réponse cochée :</span>
                    {(question.kind === "qcm" ? (item.choix ?? []).map((_, i) => ({ libelle: lettre(i), valeur: { index: i } })) : [
                      { libelle: "Vrai", valeur: { vrai: true } },
                      { libelle: "Faux", valeur: { vrai: false } },
                    ]).map((o) => (
                      <form key={o.libelle} action={saisirReponse}>
                        <input type="hidden" name="evaluation" value={e.id} />
                        <input type="hidden" name="copie" value={c.id} />
                        <input type="hidden" name="question" value={question.id} />
                        <input type="hidden" name="reponse" value={JSON.stringify(o.valeur)} />
                        <button type="submit" className="bouton bouton-compact bouton-secondaire min-w-[44px]">
                          {o.libelle}
                        </button>
                      </form>
                    ))}
                  </div>
                ) : null}

                {!publiee ? (
                  <div className="mt-3">
                    <NoteQuestion
                      evaluation={e.id}
                      copie={c.id}
                      question={question.id}
                      maximum={question.points}
                      points={correction?.points ?? null}
                      commentaire={correction?.commentaire ?? null}
                      automatique={correction?.automatique ?? false}
                    />
                  </div>
                ) : correction?.commentaire ? (
                  <p className="m-0 mt-2 text-[0.9375rem]">Commentaire : {correction.commentaire}</p>
                ) : null}
              </li>
            );
          })}
        </ul>
      </section>
    </div>
  );
}
