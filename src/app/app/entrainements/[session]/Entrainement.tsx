"use client";

import Link from "next/link";
import { CheckCircle2, HandHelping, Lightbulb, XCircle } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { demanderAide, tenter } from "@/app/app/reviser/actions";
import type { QuestionSession } from "@/lib/v6/fiches";

interface Correction {
  readonly correct: boolean | null;
  readonly explication: string | null;
  readonly source_lesson_id: string | null;
  readonly source_block_id: string | null;
  readonly statut: string | null;
}

/**
 * Une question à la fois. Choisir puis valider ; la tentative acquittée est
 * verrouillée ; la correction et sa source s'affichent ensuite. Une erreur
 * réseau garde la réponse sans faire avancer la progression ; le même
 * identifiant client est réutilisé, donc rien n'est compté deux fois.
 * Pas de note : un bilan, et des liens vers le cours.
 */
export function Entrainement({ session, questions }: { session: string; questions: readonly QuestionSession[] }) {
  const premiere = Math.max(0, questions.findIndex((q) => q.tentativeId === null));
  const [index, setIndex] = useState(questions.every((q) => q.tentativeId !== null) ? questions.length : premiere);
  const [reponses, setReponses] = useState<Record<string, string>>({});
  const [corrections, setCorrections] = useState<Record<string, Correction>>(() =>
    Object.fromEntries(
      questions.filter((q) => q.tentativeId !== null).map((q) => [q.versionId, { correct: q.correct, explication: null, source_lesson_id: null, source_block_id: null, statut: null }]),
    ),
  );
  const [aides, setAides] = useState<Record<string, string[]>>({});
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const clients = useMemo(() => Object.fromEntries(questions.map((q) => [q.versionId, crypto.randomUUID()])), [questions]);
  const debut = useRef(Date.now());
  const titre = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    debut.current = Date.now();
    titre.current?.focus();
  }, [index]);

  if (index >= questions.length) {
    const reussies = Object.values(corrections).filter((c) => c.correct === true).length;
    const corrigees = Object.values(corrections).filter((c) => c.correct !== null).length;
    return (
      <div className="panneau text-center">
        <p className="titre-section m-0">Entraînement terminé</p>
        <p className="m-0 mt-2 text-[color:var(--color-encre-faible)]">
          {reussies} réussite{reussies > 1 ? "s" : ""} sur {corrigees} question{corrigees > 1 ? "s" : ""} corrigée{corrigees > 1 ? "s" : ""}. Ce n&apos;est pas une note : tes
          erreurs sont rangées dans ton carnet, pour y revenir.
        </p>
        <div className="mt-5 flex flex-wrap justify-center gap-2">
          <Link href="/app/erreurs" className="bouton bouton-primaire">
            Mon carnet d&apos;erreurs
          </Link>
          <Link href="/app/reviser" className="bouton bouton-secondaire">
            Réviser autre chose
          </Link>
        </div>
      </div>
    );
  }

  const q = questions[index]!;
  const correction = corrections[q.versionId];
  const valeur = reponses[q.versionId] ?? "";

  const valider = async () => {
    setEnvoi(true);
    setErreur(null);
    const reponse = q.kind === "qcm" ? { index: Number(valeur) } : q.kind === "numerique" ? { valeur } : { texte: valeur };
    try {
      const r = await tenter(q.versionId, reponse, clients[q.versionId]!, session, (Date.now() - debut.current) / 1000);
      if (!r.ok) {
        setErreur(r.message);
        return;
      }
      setCorrections((c) => ({ ...c, [q.versionId]: (r.donnees ?? { correct: null, explication: null }) as Correction }));
    } catch {
      setErreur("Ta réponse n'a pas été envoyée (connexion). Elle est gardée : réessaie, elle ne sera comptée qu'une fois.");
    } finally {
      setEnvoi(false);
    }
  };

  const aide = async (niveau: "indice" | "exemple") => {
    const r = await demanderAide(q.versionId, niveau);
    if (r.ok) {
      const texte = typeof r.donnees === "string" && r.donnees ? r.donnees : niveau === "indice" ? "Ton professeur n'a pas prévu d'indice pour cet exercice." : "Pas d'exemple prévu pour cet exercice.";
      setAides((a) => ({ ...a, [q.versionId]: [...(a[q.versionId] ?? []), texte] }));
    } else setErreur(r.message);
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="meta m-0">
          Question {index + 1} sur {questions.length}
          {q.notion ? ` · ${q.notion}` : ""}
        </p>
        <div className="h-1.5 w-40 overflow-hidden rounded-full bg-[color:var(--color-survol)]" aria-hidden="true">
          <div className="h-full bg-[color:var(--color-accent)]" style={{ width: `${(index / questions.length) * 100}%` }} />
        </div>
      </div>
      <section className="panneau">
        <h2 ref={titre} tabIndex={-1} className="titre-section outline-none">
          {q.enonce}
        </h2>
        <form
          className="mt-5"
          onSubmit={(e) => {
            e.preventDefault();
            if (!correction && valeur !== "") void valider();
          }}
        >
          {q.kind === "qcm" ? (
            <fieldset disabled={Boolean(correction)} className="m-0 grid gap-2 border-0 p-0">
              <legend className="sr-only">Choix de réponse</legend>
              {(q.choix ?? []).map((c, i) => {
                const choisi = valeur === String(i);
                const ton = correction && choisi ? (correction.correct ? "border-[color:var(--color-succes)] bg-[color:var(--color-succes-fond)]" : "border-[color:var(--color-erreur)] bg-[color:var(--color-erreur-fond)]") : choisi ? "border-[color:var(--color-focus)] bg-[color:var(--color-rose-clair)]" : "border-[color:var(--color-bordure)]";
                return (
                  <label key={i} className={`flex min-h-[48px] cursor-pointer items-center gap-3 rounded-[10px] border px-4 py-3 ${ton}`}>
                    <input type="radio" name="choix" value={i} checked={choisi} onChange={() => setReponses((r) => ({ ...r, [q.versionId]: String(i) }))} />
                    {c}
                  </label>
                );
              })}
            </fieldset>
          ) : (
            <div>
              <label htmlFor={`rep-${q.versionId}`} className="mb-1.5 block text-[0.8125rem] font-semibold">
                Ta réponse
              </label>
              {q.kind === "numerique" ? (
                <input
                  id={`rep-${q.versionId}`}
                  className="champ max-w-[240px]"
                  inputMode="decimal"
                  value={valeur}
                  disabled={Boolean(correction)}
                  onChange={(e) => setReponses((r) => ({ ...r, [q.versionId]: e.target.value }))}
                />
              ) : (
                <textarea
                  id={`rep-${q.versionId}`}
                  className="champ"
                  rows={4}
                  value={valeur}
                  disabled={Boolean(correction)}
                  onChange={(e) => setReponses((r) => ({ ...r, [q.versionId]: e.target.value }))}
                />
              )}
            </div>
          )}
          {erreur ? (
            <p role="alert" className="m-0 mt-3 text-[color:var(--color-erreur)]">
              {erreur}
            </p>
          ) : null}
          {!correction ? (
            <div className="mt-5 flex flex-wrap gap-2">
              <button type="submit" className="bouton bouton-primaire" disabled={valeur === "" || envoi}>
                {envoi ? "Vérification…" : "Valider"}
              </button>
              <button type="button" className="bouton bouton-discret" onClick={() => void aide("indice")}>
                <Lightbulb size={16} strokeWidth={1.75} aria-hidden="true" /> Un indice
              </button>
            </div>
          ) : null}
        </form>
        {(aides[q.versionId] ?? []).map((a, i) => (
          <p key={i} className="m-0 mt-3 rounded-[10px] bg-[color:var(--color-attention-fond)] p-3 text-[0.875rem]">
            <Lightbulb size={16} strokeWidth={1.75} aria-hidden="true" className="mr-1 inline" /> {a}
          </p>
        ))}
        {correction ? (
          <div role="status" className="mt-5 rounded-[12px] border border-[color:var(--color-bordure)] p-4">
            <p className="m-0 flex items-center gap-2 font-semibold">
              {correction.correct === true ? (
                <>
                  <CheckCircle2 size={20} strokeWidth={1.75} aria-hidden="true" className="text-[color:var(--color-succes)]" /> Juste
                </>
              ) : correction.correct === false ? (
                <>
                  <XCircle size={20} strokeWidth={1.75} aria-hidden="true" className="text-[color:var(--color-erreur)]" /> Pas encore
                </>
              ) : (
                "Réponse enregistrée : une réponse rédigée n'est pas corrigée automatiquement."
              )}
            </p>
            {correction.explication ? <p className="m-0 mt-2">{correction.explication}</p> : null}
            {correction.source_lesson_id ? (
              <Link className="meta" href={`/app/seances/${correction.source_lesson_id}${correction.source_block_id ? `#bloc-${correction.source_block_id}` : ""}`}>
                Revoir le passage du cours
              </Link>
            ) : null}
            <div className="mt-4 flex flex-wrap gap-2">
              <button type="button" className="bouton bouton-primaire" onClick={() => setIndex((i) => i + 1)}>
                {index + 1 < questions.length ? "Question suivante" : "Voir le bilan"}
              </button>
              {correction.correct === false ? (
                <Link href={`/app/aide?version=${q.versionId}`} className="bouton bouton-secondaire">
                  <HandHelping size={16} strokeWidth={1.75} aria-hidden="true" /> Débloque-moi
                </Link>
              ) : null}
            </div>
          </div>
        ) : null}
      </section>
    </div>
  );
}
