import { Shuffle, Trash2 } from "lucide-react";
import { distribuer, supprimerQuestion } from "@/app/professeur/evaluations/actions";
import { AjouterQuestion, FormulaireAction, ImporterBanque, Reglages } from "@/components/evaluations/FormulairesProf";
import { Encadre, Etiquette } from "@/components/study/ui";
import { isoVersParis } from "@/lib/evaluations/dates";
import { aleaDepuisGraine, CORRECTION_AUTOMATIQUE, LIBELLES_GENRE, problemeQuestion, rendreTexte, tirerValeurs } from "@/lib/evaluations/sujet";
import type { EvaluationProf, ExerciceDeBanque } from "@/lib/v6/evaluations";

const lettre = (i: number) => String.fromCharCode(65 + i);

/** Un tirage d'exemple, pour voir ce que recevra un élève. null si le modèle est invalide. */
function exempleTire(q: EvaluationProf["questions"][number]): string | null {
  if (!q.parametres) return null;
  try {
    const v = tirerValeurs(q.parametres, aleaDepuisGraine(q.id));
    const choix = (q.choix ?? []).map((c, i) => `${lettre(i)}. ${rendreTexte(c, v)}`).join("   ");
    return `${rendreTexte(q.enonce, v)}${choix ? `   ${choix}` : ""}`;
  } catch {
    return null;
  }
}

function resumeCorrige(q: EvaluationProf["questions"][number]): string {
  const c = q.corrige;
  switch (q.kind) {
    case "qcm":
      return c.index !== undefined ? `Réponse ${lettre(c.index)}` : "";
    case "qcm_multiple":
      return c.indices?.length ? `Réponses ${c.indices.map(lettre).join(", ")}` : "";
    case "vrai_faux":
      return c.vrai ? "Vrai" : "Faux";
    case "numerique":
      return `${c.formule ? `= ${c.formule}` : String(c.valeur).replace(".", ",")}${c.tolerance ? ` (± ${c.tolerance})` : ""}`;
    case "courte":
      return (c.acceptees ?? []).join(" ou ");
    default:
      return "Corrigée à la main";
  }
}

/** Onglet « Sujet » : réglages, questions, ajout, import, distribution. */
export function OngletSujet({ prof, banque, eleves }: { prof: EvaluationProf; banque: readonly ExerciceDeBanque[]; eleves: number }) {
  const { evaluation: e, questions } = prof;
  const figee = e.distribueeLe !== null;
  const total = questions.reduce((s, q) => s + q.points, 0);
  const problemes = questions.map((q) => ({ q, p: problemeQuestion(q, q.corrige) })).filter((x) => x.p);
  const variantes = questions.some((q) => q.parametres && Object.keys(q.parametres).length > 0);

  return (
    <div className="grid gap-8 lg:grid-cols-[minmax(0,1fr)_360px]">
      <div className="grid content-start gap-6">
        <section aria-labelledby="questions" className="panneau">
          <div className="mb-3 flex flex-wrap items-baseline justify-between gap-3">
            <h2 id="questions" className="titre-bloc m-0 font-bold">
              Questions
            </h2>
            <p className="meta m-0">
              {questions.length} question{questions.length > 1 ? "s" : ""} · {String(total).replace(".", ",")} point{total > 1 ? "s" : ""}
            </p>
          </div>
          {questions.length === 0 ? (
            <p className="meta m-0">Ajoutez une question ci-dessous, ou importez des exercices de votre banque.</p>
          ) : (
            <ol className="m-0 grid list-none gap-3 p-0">
              {questions.map((q) => (
                <li key={q.id} className="rounded-[var(--rayon-l)] border border-[color:var(--color-bordure)] border-l-[3px] border-l-[color:var(--color-accent)] p-4">
                  <div className="flex flex-wrap items-start justify-between gap-3">
                    <p className="m-0 font-semibold">
                      {q.ordre}. {q.enonce}
                    </p>
                    <span className="meta shrink-0">{String(q.points).replace(".", ",")} pt</span>
                  </div>
                  {q.choix ? (
                    <ul className="m-0 mt-2 grid list-none gap-1 p-0 text-[0.9375rem]">
                      {q.choix.map((c, i) => (
                        <li key={i}>
                          {lettre(i)}. {c}
                        </li>
                      ))}
                    </ul>
                  ) : null}
                  {exempleTire(q) ? <p className="meta m-0 mt-2">Exemple tiré : {exempleTire(q)}</p> : null}
                  <div className="mt-3 flex flex-wrap items-center gap-2">
                    <Etiquette>{LIBELLES_GENRE[q.kind]}</Etiquette>
                    {q.notion ? <Etiquette ton="rose">{q.notion}</Etiquette> : null}
                    {q.parametres ? (
                      <Etiquette ton="attention">
                        <Shuffle size={12} aria-hidden="true" className="mr-1 inline" />
                        Valeurs par élève
                      </Etiquette>
                    ) : null}
                    <span className="meta">
                      {CORRECTION_AUTOMATIQUE.has(q.kind) ? "Auto" : "À la main"} · {resumeCorrige(q)}
                    </span>
                    {!figee ? (
                      <form action={supprimerQuestion} className="ml-auto">
                        <input type="hidden" name="evaluation" value={e.id} />
                        <input type="hidden" name="question" value={q.id} />
                        <button type="submit" className="bouton bouton-compact bouton-discret" aria-label={`Retirer la question ${q.ordre}`}>
                          <Trash2 size={16} aria-hidden="true" /> Retirer
                        </button>
                      </form>
                    ) : null}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </section>

        {!figee ? (
          <>
            <section aria-labelledby="ajouter" className="panneau">
              <h2 id="ajouter" className="titre-bloc m-0 mb-4 font-bold">
                Ajouter une question
              </h2>
              <AjouterQuestion evaluation={e.id} notions={prof.notions} />
            </section>
            <section aria-labelledby="banque" className="panneau">
              <h2 id="banque" className="titre-bloc m-0 mb-1 font-bold">
                Importer de la banque d&apos;exercices
              </h2>
              <p className="meta m-0 mb-3">Énoncé, choix, corrigé et explication sont repris ; vous ajustez ensuite les points.</p>
              <ImporterBanque evaluation={e.id} exercices={banque} />
            </section>
          </>
        ) : null}
      </div>

      <aside className="grid content-start gap-6">
        <section aria-labelledby="distribution" className="panneau">
          <h2 id="distribution" className="titre-bloc m-0 mb-2 font-bold">
            {figee ? "Distribuée" : "Distribuer"}
          </h2>
          {figee ? (
            <p className="meta m-0 mb-3">
              Chaque élève a reçu son sujet. Un élève arrivé depuis dans la classe reçoit le sien en redistribuant ; les autres gardent le leur.
            </p>
          ) : (
            <p className="meta m-0 mb-3">
              {eleves} élève{eleves > 1 ? "s" : ""} recevront chacun un sujet tiré pour eux
              {e.melangerQuestions || e.melangerChoix || variantes ? " (ordre, choix et valeurs différents)" : ""}. Le sujet est ensuite figé.
            </p>
          )}
          {problemes.length > 0 ? (
            <Encadre titre="À régler avant de distribuer">
              <ul className="m-0 pl-4">
                {problemes.map(({ q, p }) => (
                  <li key={q.id}>
                    Question {q.ordre} : {p}
                  </li>
                ))}
              </ul>
            </Encadre>
          ) : (
            <FormulaireAction
              action={distribuer}
              evaluation={e.id}
              libelle={figee ? "Distribuer aux nouveaux élèves" : "Distribuer les sujets"}
              enCours="Tirage des sujets…"
              ton={figee ? "secondaire" : "primaire"}
              confirmation={figee ? undefined : "Distribuer ? Le sujet ne pourra plus être modifié."}
            />
          )}
        </section>
        <section aria-labelledby="reglages" className="panneau">
          <h2 id="reglages" className="titre-bloc m-0 mb-4 font-bold">
            Réglages
          </h2>
          <Reglages
            evaluation={e.id}
            valeurs={{
              titre: e.titre,
              consigne: e.consigne ?? "",
              ouvreLe: isoVersParis(e.ouvreLe),
              fermeLe: isoVersParis(e.fermeLe),
              duree: e.dureeMinutes,
              melangerQuestions: e.melangerQuestions,
              melangerChoix: e.melangerChoix,
              notation: e.notation,
              papier: e.support === "papier",
            }}
          />
        </section>
      </aside>
    </div>
  );
}
