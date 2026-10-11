import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft } from "lucide-react";
import { BoutonImprimer } from "@/components/evaluations/BoutonImprimer";
import { aleaDepuisGraine, genererCopie, type ElementSujet } from "@/lib/evaluations/sujet";
import { jetonAccesDe, sessionCourante } from "@/lib/session-serveur";
import { coursDuProfesseur } from "@/lib/studio";
import { evaluationDuProfesseur, suiviEvaluation } from "@/lib/v6/evaluations";

export const metadata: Metadata = { title: "Imprimer l'évaluation" };
export const dynamic = "force-dynamic";

const lettre = (i: number) => String.fromCharCode(65 + i);

/**
 * Sujets imprimables : une feuille par élève, avec SON sujet (ordre, choix et
 * valeurs tirés pour lui), son nom en tête. Avant distribution, un exemple.
 * Les cases des QCM se reportent ensuite en un clic dans l'onglet Correction.
 */
export default async function PageImprimer({ params }: { params: Promise<{ id: string }> }) {
  const personne = await sessionCourante();
  if (personne === null) redirect("/connexion");
  const jeton = await jetonAccesDe(personne);
  if (jeton === null) redirect("/connexion");
  const { id } = await params;
  const prof = await evaluationDuProfesseur(jeton, id);
  if (prof === null) notFound();
  const e = prof.evaluation;
  const [cours, suivi] = await Promise.all([coursDuProfesseur(jeton), suiviEvaluation(jeton, prof)]);
  const libelle = cours.find((c) => c.id === e.coursId)?.libelle ?? "";
  const noms = new Map(suivi.eleves.map((x) => [x.profileId, `${x.nom} ${x.prenom}`]));

  const feuilles: { nom: string | null; sujet: readonly ElementSujet[] }[] =
    suivi.copies.length > 0
      ? [...suivi.copies].sort((a, b) => (noms.get(a.profileId) ?? "").localeCompare(noms.get(b.profileId) ?? "", "fr")).map((c) => ({ nom: noms.get(c.profileId) ?? null, sujet: c.sujet }))
      : [
          {
            nom: null,
            sujet: genererCopie(prof.questions, Object.fromEntries(prof.questions.map((q) => [q.id, q.corrige])), { melangerQuestions: false, melangerChoix: false }, aleaDepuisGraine(e.id)).sujet,
          },
        ];
  const total = prof.questions.reduce((s, q) => s + q.points, 0);

  return (
    <>
      <style>{`@media print {
        .app-barre, .app-entete, .app-nav-mobile, .ecran-seulement { display: none !important; }
        body, main { background: #fff !important; margin: 0 !important; padding: 0 !important; }
        .feuille { break-after: page; border: 0 !important; box-shadow: none !important; padding: 0 !important; }
      }`}</style>
      <div className="ecran-seulement mb-6 flex flex-wrap items-center justify-between gap-3">
        <Link href={`/professeur/evaluations/${e.id}`} className="meta inline-flex items-center gap-1 no-underline">
          <ArrowLeft size={14} aria-hidden="true" /> Retour à l&apos;évaluation
        </Link>
        <p className="meta m-0">
          {suivi.copies.length > 0 ? `${feuilles.length} feuille${feuilles.length > 1 ? "s" : ""}, une par élève, chacune avec son sujet.` : "Aperçu : distribuez pour imprimer un sujet par élève."}
        </p>
        <BoutonImprimer />
      </div>

      {feuilles.map((f, k) => (
        <article key={k} className="feuille mb-8 border border-[color:var(--color-bordure)] bg-white p-8 text-[#111]">
          <header className="flex flex-wrap items-start justify-between gap-4 border-b-2 border-[#111] pb-3">
            <div>
              <p className="m-0 text-[0.75rem] font-bold uppercase tracking-[0.12em]">{libelle}</p>
              <h1 className="m-0 mt-1 text-[1.5rem] font-extrabold">{e.titre}</h1>
              <p className="m-0 mt-1 text-[0.875rem]">
                {String(total).replace(".", ",")} points{e.dureeMinutes ? ` · ${e.dureeMinutes} minutes` : ""}
              </p>
            </div>
            <div className="min-w-[240px] text-[0.9375rem]">
              <p className="m-0">Nom : {f.nom ?? "…………………………………………"}</p>
              <p className="m-0 mt-2">Date : ……… / ……… / ………</p>
            </div>
          </header>
          {e.consigne ? <p className="m-0 mt-4 italic">{e.consigne}</p> : null}
          <ol className="m-0 mt-6 grid list-none gap-6 p-0">
            {f.sujet.map((s) => (
              <li key={s.question_id} className="break-inside-avoid">
                <p className="m-0 font-semibold">
                  {s.ordre}. {s.enonce} <span className="font-normal">({String(s.points).replace(".", ",")} pt)</span>
                </p>
                {s.choix ? (
                  <ul className="m-0 mt-2 grid list-none gap-1.5 p-0">
                    {s.choix.map((c, i) => (
                      <li key={i} className="flex items-center gap-3">
                        <span className="inline-block h-4 w-4 border-[1.5px] border-[#111]" aria-hidden="true" />
                        {lettre(i)}. {c}
                      </li>
                    ))}
                  </ul>
                ) : s.kind === "vrai_faux" ? (
                  <p className="m-0 mt-2 flex gap-8">
                    <span className="flex items-center gap-2">
                      <span className="inline-block h-4 w-4 border-[1.5px] border-[#111]" aria-hidden="true" /> Vrai
                    </span>
                    <span className="flex items-center gap-2">
                      <span className="inline-block h-4 w-4 border-[1.5px] border-[#111]" aria-hidden="true" /> Faux
                    </span>
                  </p>
                ) : (
                  <div className="mt-2" aria-hidden="true">
                    {Array.from({ length: s.kind === "redigee" ? Math.min(14, 3 + Math.round(s.points * 2)) : 1 }, (_, i) => (
                      <div key={i} className="h-7 border-b border-dotted border-[#888]" />
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ol>
        </article>
      ))}
    </>
  );
}
