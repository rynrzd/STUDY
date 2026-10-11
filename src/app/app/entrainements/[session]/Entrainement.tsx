"use client";

import Link from "next/link";
import { CheckCircle2, HandHelping, Lightbulb, XCircle } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { demanderAide, tenter } from "@/app/app/reviser/actions";
import { BarreProgression, BilanEntrainement, EnteteRetour, IndiceDevoile, NotionConsolidee, RetourReponse } from "@/components/study/Celebrations";
import type { Semaine } from "@/lib/semaine";
import type { QuestionSession } from "@/lib/v6/fiches";

interface Correction {
  readonly correct: boolean | null;
  readonly explication: string | null;
  readonly source_lesson_id: string | null;
  readonly source_block_id: string | null;
  readonly statut: string | null;
  readonly rejouee?: boolean | null;
}

interface Aide {
  readonly texte: string;
  /** Prévue par le professeur (sinon : un message qui dit qu'il n'y en a pas). */
  readonly prevue: boolean;
}

/**
 * Une question à la fois. Choisir puis valider ; la tentative acquittée est
 * verrouillée ; la correction et sa source s'affichent ensuite. Une erreur
 * réseau garde la réponse sans faire avancer la progression ; le même
 * identifiant client est réutilisé, donc rien n'est compté deux fois.
 * Pas de note : un bilan, et des liens vers le cours.
 *
 * Les célébrations saluent de vrais événements : réponse juste, notion qui
 * passe réellement à « consolidée » (jamais celle qui l'était déjà), jours
 * d'entraînement de la semaine.
 */
export function Entrainement({
  session,
  questions,
  semaine = null,
  dejaConsolidees = null,
}: {
  session: string;
  questions: readonly QuestionSession[];
  semaine?: Semaine | null;
  /** Notions déjà consolidées à l'ouverture ; `null` = inconnues, rien n'est fêté. */
  dejaConsolidees?: readonly string[] | null;
}) {
  const premiere = Math.max(0, questions.findIndex((q) => q.tentativeId === null));
  const [index, setIndex] = useState(questions.every((q) => q.tentativeId !== null) ? questions.length : premiere);
  const [reponses, setReponses] = useState<Record<string, string>>({});
  const [corrections, setCorrections] = useState<Record<string, Correction>>(() =>
    Object.fromEntries(
      questions.filter((q) => q.tentativeId !== null).map((q) => [q.versionId, { correct: q.correct, explication: null, source_lesson_id: null, source_block_id: null, statut: null }]),
    ),
  );
  const [aides, setAides] = useState<Record<string, Aide[]>>({});
  const [consolidees, setConsolidees] = useState<Record<string, string>>({});
  const [entraineAujourdhui, setEntraineAujourdhui] = useState(false);
  const [envoi, setEnvoi] = useState(false);
  const [erreur, setErreur] = useState<string | null>(null);
  const clients = useMemo(() => Object.fromEntries(questions.map((q) => [q.versionId, crypto.randomUUID()])), [questions]);
  const debut = useRef(0);
  const titre = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    debut.current = Date.now();
    titre.current?.focus();
  }, [index]);

  if (index >= questions.length) {
    const reussies = Object.values(corrections).filter((c) => c.correct === true).length;
    const corrigees = Object.values(corrections).filter((c) => c.correct !== null).length;
    // Une tentative faite pendant cette visite allume aujourd'hui, sans relire la base.
    const semaineVue =
      semaine && entraineAujourdhui && !semaine.jours[semaine.aujourdHui]
        ? { ...semaine, jours: semaine.jours.map((j, i) => j || i === semaine.aujourdHui), actifs: semaine.actifs + 1 }
        : semaine;
    return (
      <BilanEntrainement reussies={reussies} corrigees={corrigees} semaine={semaineVue}>
        <Link href="/app/erreurs" className="bouton bouton-primaire">
          Mon carnet d&apos;erreurs
        </Link>
        <Link href="/app/reviser" className="bouton bouton-secondaire">
          Réviser autre chose
        </Link>
      </BilanEntrainement>
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
      const recue = (r.donnees ?? { correct: null, explication: null }) as Correction;
      setCorrections((c) => ({ ...c, [q.versionId]: recue }));
      setEntraineAujourdhui(true);
      // Fêter le passage réel à « consolidée » : ni une tentative rejouée, ni
      // une notion qui l'était déjà, ni deux fois la même.
      if (
        recue.statut === "consolide" &&
        recue.rejouee !== true &&
        q.notion &&
        dejaConsolidees !== null &&
        !dejaConsolidees.includes(q.notion) &&
        !Object.values(consolidees).includes(q.notion)
      ) {
        const notion = q.notion;
        setConsolidees((c) => ({ ...c, [q.versionId]: notion }));
      }
    } catch {
      setErreur("Ta réponse n'a pas été envoyée (connexion). Elle est gardée : réessaie, elle ne sera comptée qu'une fois.");
    } finally {
      setEnvoi(false);
    }
  };

  const aide = async (niveau: "indice" | "exemple") => {
    const r = await demanderAide(q.versionId, niveau);
    if (r.ok) {
      const prevue = typeof r.donnees === "string" && r.donnees !== "";
      const texte = prevue ? (r.donnees as string) : niveau === "indice" ? "Ton professeur n'a pas prévu d'indice pour cet exercice." : "Pas d'exemple prévu pour cet exercice.";
      setAides((a) => ({ ...a, [q.versionId]: [...(a[q.versionId] ?? []), { texte, prevue }] }));
    } else setErreur(r.message);
  };

  return (
    <div>
      <div className="mb-4 flex items-center justify-between gap-3">
        <p className="meta m-0">
          Question {index + 1} sur {questions.length}
          {q.notion ? ` · ${q.notion}` : ""}
        </p>
        <BarreProgression fait={index} total={questions.length} />
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
                  <label key={i} className={`choix-reponse flex min-h-[48px] cursor-pointer items-center gap-3 rounded-[var(--rayon-m)] border px-4 py-3 ${ton}`}>
                    <input type="radio" name="choix" value={i} checked={choisi} onChange={() => setReponses((r) => ({ ...r, [q.versionId]: String(i) }))} />
                    <span className="flex-1">{c}</span>
                    {/* Jamais la couleur seule : une icône et un mot accompagnent l’état. */}
                    {correction && choisi && correction.correct === true ? (
                      <span className="inline-flex items-center gap-1 text-[0.8125rem] font-semibold text-[color:var(--color-succes)]">
                        <CheckCircle2 size={18} strokeWidth={1.75} aria-hidden="true" /> Ta réponse, juste
                      </span>
                    ) : correction && choisi && correction.correct === false ? (
                      <span className="inline-flex items-center gap-1 text-[0.8125rem] font-semibold text-[color:var(--color-erreur)]">
                        <XCircle size={18} strokeWidth={1.75} aria-hidden="true" /> Ta réponse
                      </span>
                    ) : null}
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
        {(aides[q.versionId] ?? []).map((a, i) =>
          a.prevue ? (
            <IndiceDevoile key={i} texte={a.texte} />
          ) : (
            <p key={i} className="m-0 mt-3 bg-[color:var(--color-attention-fond)] p-3 text-[0.875rem]">
              <Lightbulb size={16} strokeWidth={1.75} aria-hidden="true" className="mr-1 inline" /> {a.texte}
            </p>
          ),
        )}
        {correction ? (
          <RetourReponse ton={correction.correct === true ? "succes" : correction.correct === false ? "erreur" : "neutre"}>
            {correction.correct === null ? (
              <p className="m-0 font-semibold">Réponse enregistrée : une réponse rédigée n&apos;est pas corrigée automatiquement.</p>
            ) : (
              <EnteteRetour juste={correction.correct} sansIndice={!(aides[q.versionId] ?? []).some((a) => a.prevue)} />
            )}
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
          </RetourReponse>
        ) : null}
        {consolidees[q.versionId] ? <NotionConsolidee notion={consolidees[q.versionId]!} /> : null}
      </section>
    </div>
  );
}
