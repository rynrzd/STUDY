import Link from "next/link";
import { CircleHelp, MessageCircleQuestion } from "lucide-react";
import type { QuestionDeSeance } from "@/lib/v6/questions-seance";
import { BoutonMemeQuestion } from "./BoutonMemeQuestion";
import { Etiquette, ICONE, dateLisible } from "./ui";

/**
 * Les questions de la classe sur une séance, sous l'onglet « Questions ».
 * D'abord celles qui ont une réponse d'un professeur (on la lit sans
 * quitter le cours), puis celles en attente — où « J'ai la même question »
 * évite de reposer la même chose et dit au professeur combien sont bloqués.
 */
export function QuestionsDeLaSeance({
  questions,
  salonLien,
  seance,
}: {
  questions: readonly QuestionDeSeance[] | null;
  salonLien: string | null;
  seance: string;
}) {
  const repondues = (questions ?? []).filter((q) => q.reponseAdulte !== null);
  const enAttente = (questions ?? []).filter((q) => q.reponseAdulte === null);

  return (
    <section aria-labelledby="questions-classe" className="grid gap-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 id="questions-classe" className="titre-section m-0">
            Les questions de la classe
          </h2>
          <p className="meta m-0 mt-1">Posées dans le salon de la matière à propos de cette séance.</p>
        </div>
        {salonLien ? (
          <Link href={`${salonLien}?seance=${seance}`} className="bouton bouton-primaire">
            <MessageCircleQuestion {...ICONE} /> Poser ma question
          </Link>
        ) : null}
      </div>

      {questions === null ? (
        <p role="alert" className="m-0 text-[color:var(--color-erreur)]">
          Les questions n&apos;ont pas pu être chargées. Réessaie dans un instant.
        </p>
      ) : questions.length === 0 ? (
        <div className="encadre" data-ton="neutre">
          <p className="m-0">
            Personne n&apos;a encore posé de question sur cette séance. Si quelque chose bloque, pose-la : la séance sera citée et la réponse restera ici pour toute la classe.
          </p>
        </div>
      ) : (
        <>
          {repondues.length > 0 ? (
            <ul className="liste-r2" aria-label="Questions avec une réponse du professeur">
              {repondues.map((q) => (
                <Question key={q.id} q={q} />
              ))}
            </ul>
          ) : null}
          {enAttente.length > 0 ? (
            <>
              <h3 className="titre-bloc m-0 font-bold">En attente de réponse</h3>
              <ul className="liste-r2" aria-label="Questions en attente de réponse">
                {enAttente.map((q) => (
                  <Question key={q.id} q={q} />
                ))}
              </ul>
            </>
          ) : null}
        </>
      )}
    </section>
  );
}

function Question({ q }: { q: QuestionDeSeance }) {
  return (
    <li className="grid gap-2 p-4">
      <div className="flex items-start gap-3">
        <span className="tuile" aria-hidden="true">
          <CircleHelp size={20} strokeWidth={1.75} />
        </span>
        <div className="min-w-0 flex-1">
          <p className="m-0 whitespace-pre-line font-semibold">{q.texte}</p>
          <p className="meta m-0 mt-0.5">
            {q.deMoi ? "Ta question" : q.auteur} · {dateLisible(q.le, { day: "numeric", month: "short" })} · {q.salon}
          </p>
        </div>
        {q.reponseAdulte ? <Etiquette ton="succes">Répondue</Etiquette> : <Etiquette ton="attention">En attente</Etiquette>}
      </div>
      {q.reponseAdulte ? (
        <div className="ml-[52px] rounded-[4px] border-l-[3px] border-[color:var(--color-accent)] bg-[color:var(--color-rose-clair)] px-3 py-2 text-[0.9375rem]">
          <p className="m-0 line-clamp-4 whitespace-pre-line">{q.reponseAdulte.texte}</p>
          <p className="meta m-0 mt-1">
            {q.reponseAdulte.auteur} · {dateLisible(q.reponseAdulte.le, { day: "numeric", month: "short" })}
          </p>
        </div>
      ) : null}
      <div className="ml-[52px] flex flex-wrap items-center gap-2">
        <Link href={q.href} className="bouton bouton-secondaire bouton-compact">
          Voir la discussion{q.reponses > 0 ? ` (${q.reponses} réponse${q.reponses > 1 ? "s" : ""})` : ""}
        </Link>
        {!q.deMoi && !q.reponseAdulte ? (
          <BoutonMemeQuestion message={q.id} actif={q.moiAussi} nombre={q.memeQuestion} />
        ) : q.memeQuestion > 0 ? (
          <span className="meta">
            {q.memeQuestion} élève{q.memeQuestion > 1 ? "s ont" : " a"} la même question
          </span>
        ) : null}
      </div>
    </li>
  );
}
