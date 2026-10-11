"use client";

import { AlertTriangle, CheckCircle2, ChevronLeft, ChevronRight, Clock, CloudOff, Send } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import { commencer, rendre, repondre, signalerSortie, type CopieOuverte } from "@/app/app/evaluations/actions";
import { EnteteRemise } from "@/components/study/Celebrations";
import type { ElementSujet } from "@/lib/evaluations/sujet";

type Reponse = Record<string, unknown>;
type Sauvegarde = "enregistree" | "en_cours" | "en_attente";

const lettre = (i: number) => String.fromCharCode(65 + i);
const cleLocale = (copie: string) => `study-eval-${copie}`;

/** Copie de secours sur l'appareil : seulement les réponses pas encore confirmées par le serveur. */
function lireSecours(copie: string): Record<string, Reponse> {
  try {
    return JSON.parse(window.localStorage.getItem(cleLocale(copie)) ?? "{}") as Record<string, Reponse>;
  } catch {
    return {};
  }
}
function ecrireSecours(copie: string, valeurs: Record<string, Reponse>) {
  try {
    if (Object.keys(valeurs).length === 0) window.localStorage.removeItem(cleLocale(copie));
    else window.localStorage.setItem(cleLocale(copie), JSON.stringify(valeurs));
  } catch {
    // Stockage indisponible (navigation privée) : le serveur reste la référence.
  }
}

const repondue = (item: ElementSujet, r: Reponse | undefined) => {
  if (!r) return false;
  if (item.kind === "qcm") return typeof r.index === "number";
  if (item.kind === "qcm_multiple") return Array.isArray(r.indices) && r.indices.length > 0;
  if (item.kind === "vrai_faux") return typeof r.vrai === "boolean";
  if (item.kind === "numerique") return typeof r.valeur === "string" && r.valeur.trim() !== "";
  return typeof r.texte === "string" && r.texte.trim() !== "";
};

function minuteur(ms: number) {
  const total = Math.max(0, Math.round(ms / 1000));
  const h = Math.floor(total / 3600);
  const m = Math.floor((total % 3600) / 60);
  const s = total % 60;
  return h > 0 ? `${h} h ${String(m).padStart(2, "0")}` : `${m}:${String(s).padStart(2, "0")}`;
}

/**
 * La passation, une question à la fois. Chaque réponse est enregistrée sur le
 * serveur dès qu'elle change ; si le réseau tombe, elle attend sur l'appareil
 * et repart seule. À l'heure limite, la copie est rendue automatiquement.
 */
export function Passation({
  evaluation,
  titre,
  consigne,
  dureeMinutes,
  dejaCommencee,
  apercu = null,
}: {
  evaluation: string;
  titre: string;
  consigne: string | null;
  dureeMinutes: number | null;
  dejaCommencee: boolean;
  /** Aperçu de développement seulement : une copie déjà ouverte, sans appel au serveur. */
  apercu?: CopieOuverte | null;
}) {
  const [copie, setCopie] = useState<CopieOuverte | null>(apercu);
  const [reponses, setReponses] = useState<Record<string, Reponse>>(() => ({ ...(apercu?.reponses ?? {}) }));
  const [etats, setEtats] = useState<Record<string, Sauvegarde>>({});
  const [index, setIndex] = useState(0);
  const [erreur, setErreur] = useState<string | null>(null);
  const [rendueLe, setRendueLe] = useState<string | null>(null);
  // Le temps vient du navigateur seulement : rien n'est calculé au rendu serveur.
  const [maintenant, setMaintenant] = useState<number | null>(null);
  const [envoi, setEnvoi] = useState(false);
  const minuteries = useRef<Record<string, ReturnType<typeof setTimeout>>>({});
  const rendueAuto = useRef(false);
  const titreQuestion = useRef<HTMLHeadingElement>(null);

  const ouvrir = useCallback(async () => {
    const r = await commencer(evaluation);
    setErreur(null);
    if (!r.ok) {
      setErreur(r.message);
      return;
    }
    setCopie(r.donnees);
    setRendueLe(r.donnees.rendueLe);
    const secours = lireSecours(r.donnees.copieId);
    setReponses({ ...r.donnees.reponses, ...secours });
    // Ce qui n'avait pas atteint le serveur repart.
    for (const [q, rep] of Object.entries(secours)) void envoyer(r.donnees.copieId, q, rep);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [evaluation]);

  const rendreCopie = useCallback(async () => {
    if (!copie) return;
    rendueAuto.current = true;
    setEnvoi(true);
    const r = await rendre(evaluation, copie.copieId);
    setEnvoi(false);
    if (r.ok) {
      setRendueLe(r.donnees);
      ecrireSecours(copie.copieId, {});
    } else setErreur(r.message);
  }, [copie, evaluation]);

  useEffect(() => {
    if (!copie || rendueLe) return;
    // Chaque seconde : le minuteur avance ; à l'heure limite, la copie part
    // toute seule (le serveur accepte une minute de grâce).
    const t = setInterval(() => {
      const m = Date.now();
      setMaintenant(m);
      if (copie.limiteLe && Date.parse(copie.limiteLe) <= m && !rendueAuto.current) void rendreCopie();
    }, 1000);
    const sortie = () => {
      if (document.visibilityState === "hidden") void signalerSortie(copie.copieId);
    };
    document.addEventListener("visibilitychange", sortie);
    return () => {
      clearInterval(t);
      document.removeEventListener("visibilitychange", sortie);
    };
  }, [copie, rendueLe, rendreCopie]);

  useEffect(() => {
    titreQuestion.current?.focus();
  }, [index]);

  async function envoyer(copieId: string, question: string, rep: Reponse, essai = 0): Promise<void> {
    setEtats((e) => ({ ...e, [question]: "en_cours" }));
    const r = await repondre(copieId, question, rep).catch(() => null);
    if (r?.ok) {
      setEtats((e) => ({ ...e, [question]: "enregistree" }));
      const secours = lireSecours(copieId);
      if (JSON.stringify(secours[question]) === JSON.stringify(rep)) {
        delete secours[question];
        ecrireSecours(copieId, secours);
      }
      return;
    }
    if (r && !r.ok && /temps|rendue/i.test(r.message)) {
      setErreur(r.message);
      return;
    }
    setEtats((e) => ({ ...e, [question]: "en_attente" }));
    if (essai < 20) setTimeout(() => void envoyer(copieId, question, rep, essai + 1), Math.min(30000, 2000 * (essai + 1)));
  }

  function changer(question: string, rep: Reponse, immediat = false) {
    if (!copie) return;
    setReponses((x) => ({ ...x, [question]: rep }));
    ecrireSecours(copie.copieId, { ...lireSecours(copie.copieId), [question]: rep });
    setEtats((e) => ({ ...e, [question]: "en_attente" }));
    clearTimeout(minuteries.current[question]);
    minuteries.current[question] = setTimeout(() => void envoyer(copie.copieId, question, rep), immediat ? 0 : 700);
  }


  const restant = copie?.limiteLe && maintenant !== null ? Date.parse(copie.limiteLe) - maintenant : null;

  /* ---- Avant de commencer ---- */
  if (!copie) {
    return (
      <section className="panneau" aria-labelledby="avant">
        <h2 id="avant" className="titre-bloc m-0 font-bold">
          {titre}
        </h2>
        {consigne ? <p className="m-0 mt-2">{consigne}</p> : null}
        <ul className="m-0 mt-4 grid gap-2 pl-5 text-[0.9375rem]">
          <li>{dureeMinutes ? `Tu auras ${dureeMinutes} minutes à partir du moment où tu commences.` : "Pas de minuteur : tu as jusqu'à la fermeture."}</li>
          <li>Chaque réponse est enregistrée toute seule, même si le réseau coupe un moment.</li>
          <li>Ton sujet est à toi : l&apos;ordre des questions et des choix peut différer de celui de tes voisins.</li>
          <li>Quitter cet onglet pendant l&apos;évaluation est signalé à ton professeur.</li>
        </ul>
        {erreur ? (
          <p role="alert" className="m-0 mt-4 font-semibold text-[color:var(--color-erreur)]">
            {erreur}
          </p>
        ) : null}
        <button type="button" className="bouton bouton-primaire mt-5" onClick={() => void ouvrir()}>
          {dejaCommencee ? "Reprendre ma copie" : "Commencer"}
        </button>
      </section>
    );
  }

  /* ---- Copie rendue ---- */
  if (rendueLe) {
    return (
      <section className="panneau text-center" aria-labelledby="rendue" role="status">
        <EnteteRemise />
        <h2 id="rendue" className="titre-bloc m-0 mt-3 font-bold text-[color:var(--color-succes)]">
          Copie rendue !
        </h2>
        <p className="m-0 mt-1 text-[color:var(--color-encre-faible)]">
          Enregistrée le{" "}
          {new Intl.DateTimeFormat("fr-FR", { timeZone: "Europe/Paris", day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" }).format(new Date(rendueLe))}. Tu verras ta copie corrigée quand ton professeur publiera les résultats.
        </p>
      </section>
    );
  }

  const sujet = copie.sujet;
  const item = sujet[index]!;
  const rep = reponses[item.question_id];
  const nonRepondues = sujet.filter((s) => !repondue(s, reponses[s.question_id])).length;
  const enAttente = Object.values(etats).some((e) => e === "en_attente");
  const etatCourant = etats[item.question_id];

  return (
    <div className="grid gap-4">
      <div className="sticky top-2 z-10 flex flex-wrap items-center justify-between gap-3 rounded-[var(--rayon-l)] border border-[color:var(--color-bordure)] bg-[color:var(--color-surface)] px-4 py-3 shadow-[var(--shadow-flottant)]">
        <p className="m-0 font-semibold">
          Question {index + 1} / {sujet.length}
        </p>
        <p className="m-0 inline-flex items-center gap-2 text-[0.875rem]" aria-live="polite">
          {enAttente ? (
            <>
              <CloudOff size={16} aria-hidden="true" className="text-[color:var(--color-attention)]" /> En attente du réseau, gardé sur ton appareil
            </>
          ) : (
            <>
              <CheckCircle2 size={16} aria-hidden="true" className="text-[color:var(--color-succes)]" /> Réponses enregistrées
            </>
          )}
        </p>
        {restant !== null ? (
          <p
            className={`m-0 inline-flex items-center gap-1 font-extrabold tabular-nums ${restant < 60000 ? "text-[color:var(--color-erreur)]" : restant < 300000 ? "text-[color:var(--color-attention)]" : ""}`}
            aria-label={`Temps restant : ${minuteur(restant)}`}
          >
            <Clock size={16} aria-hidden="true" /> {minuteur(restant)}
          </p>
        ) : null}
      </div>
      {restant !== null && restant < 300000 && restant > 0 ? (
        <p role="status" className="m-0 inline-flex items-center gap-2 font-semibold text-[color:var(--color-attention)]">
          <AlertTriangle size={16} aria-hidden="true" /> {restant < 60000 ? "Moins d'une minute : ta copie partira toute seule." : "Moins de 5 minutes."}
        </p>
      ) : null}

      <nav aria-label="Questions" className="flex flex-wrap gap-1.5">
        {sujet.map((s, i) => (
          <button
            key={s.question_id}
            type="button"
            onClick={() => setIndex(i)}
            aria-current={i === index ? "step" : undefined}
            aria-label={`Question ${i + 1}${repondue(s, reponses[s.question_id]) ? ", répondue" : ", sans réponse"}`}
            className={`grid h-10 w-10 place-items-center rounded-full border text-[0.875rem] font-bold ${i === index ? "border-[color:var(--color-accent)] bg-[color:var(--color-accent)] text-white" : repondue(s, reponses[s.question_id]) ? "border-[color:var(--color-accent)] bg-[color:var(--color-rose-clair)]" : "border-[color:var(--color-bordure-forte)] bg-[color:var(--color-surface)]"}`}
          >
            {i + 1}
          </button>
        ))}
      </nav>

      <section className="panneau" aria-labelledby="question">
        <p className="meta m-0">
          {String(item.points).replace(".", ",")} point{item.points > 1 ? "s" : ""}
          {etatCourant === "en_cours" ? " · enregistrement…" : etatCourant === "enregistree" ? " · enregistrée" : ""}
        </p>
        <h2 id="question" ref={titreQuestion} tabIndex={-1} className="titre-section m-0 mt-1 whitespace-pre-wrap outline-none">
          {item.enonce}
        </h2>

        <div className="mt-5">
          {item.kind === "qcm" || item.kind === "qcm_multiple" ? (
            <fieldset className="m-0 grid gap-2 border-0 p-0">
              <legend className="sr-only">{item.kind === "qcm" ? "Une seule réponse" : "Plusieurs réponses possibles"}</legend>
              {item.kind === "qcm_multiple" ? <p className="meta m-0 mb-1">Plusieurs réponses possibles.</p> : null}
              {(item.choix ?? []).map((c, i) => {
                const coche = item.kind === "qcm" ? rep?.index === i : Array.isArray(rep?.indices) && (rep.indices as number[]).includes(i);
                return (
                  <label
                    key={i}
                    className={`flex min-h-[52px] cursor-pointer items-center gap-3 rounded-[var(--rayon-m)] border px-4 py-3 ${coche ? "border-[color:var(--color-accent)] bg-[color:var(--color-rose-clair)]" : "border-[color:var(--color-bordure)]"}`}
                  >
                    <input
                      type={item.kind === "qcm" ? "radio" : "checkbox"}
                      name={`q-${item.question_id}`}
                      checked={coche}
                      onChange={() => {
                        if (item.kind === "qcm") changer(item.question_id, { index: i }, true);
                        else {
                          const actuels = Array.isArray(rep?.indices) ? (rep.indices as number[]) : [];
                          changer(item.question_id, { indices: coche ? actuels.filter((x) => x !== i) : [...actuels, i].sort((a, b) => a - b) }, true);
                        }
                      }}
                    />
                    <span className="font-bold">{lettre(i)}.</span>
                    <span className="flex-1">{c}</span>
                  </label>
                );
              })}
            </fieldset>
          ) : item.kind === "vrai_faux" ? (
            <fieldset className="m-0 flex gap-3 border-0 p-0">
              <legend className="sr-only">Vrai ou faux</legend>
              {[true, false].map((v) => (
                <label key={String(v)} className={`flex min-h-[52px] flex-1 cursor-pointer items-center justify-center gap-2 rounded-[var(--rayon-m)] border font-bold ${rep?.vrai === v ? "border-[color:var(--color-accent)] bg-[color:var(--color-rose-clair)]" : "border-[color:var(--color-bordure)]"}`}>
                  <input type="radio" name={`q-${item.question_id}`} checked={rep?.vrai === v} onChange={() => changer(item.question_id, { vrai: v }, true)} />
                  {v ? "Vrai" : "Faux"}
                </label>
              ))}
            </fieldset>
          ) : item.kind === "numerique" ? (
            <label className="grid max-w-[260px] gap-1.5 font-semibold">
              Ta réponse
              <input className="champ" inputMode="decimal" value={typeof rep?.valeur === "string" ? rep.valeur : ""} onChange={(e) => changer(item.question_id, { valeur: e.target.value })} />
            </label>
          ) : item.kind === "courte" ? (
            <label className="grid gap-1.5 font-semibold">
              Ta réponse
              <input className="champ" value={typeof rep?.texte === "string" ? rep.texte : ""} onChange={(e) => changer(item.question_id, { texte: e.target.value })} maxLength={500} />
            </label>
          ) : (
            <label className="grid gap-1.5 font-semibold">
              Ta réponse
              <textarea className="champ" rows={8} value={typeof rep?.texte === "string" ? rep.texte : ""} onChange={(e) => changer(item.question_id, { texte: e.target.value })} maxLength={8000} />
            </label>
          )}
        </div>
      </section>

      {erreur ? (
        <p role="alert" className="m-0 font-semibold text-[color:var(--color-erreur)]">
          {erreur}
        </p>
      ) : null}

      <div className="flex flex-wrap items-center justify-between gap-3">
        <button type="button" className="bouton bouton-secondaire" disabled={index === 0} onClick={() => setIndex((i) => i - 1)}>
          <ChevronLeft size={16} aria-hidden="true" /> Précédente
        </button>
        {index < sujet.length - 1 ? (
          <button type="button" className="bouton bouton-primaire" onClick={() => setIndex((i) => i + 1)}>
            Suivante <ChevronRight size={16} aria-hidden="true" />
          </button>
        ) : (
          <button
            type="button"
            className="bouton bouton-primaire"
            disabled={envoi}
            onClick={() => {
              const message = nonRepondues > 0 ? `${nonRepondues} question${nonRepondues > 1 ? "s" : ""} sans réponse. Rendre ta copie quand même ?` : "Rendre ta copie ? Tu ne pourras plus la modifier.";
              if (window.confirm(message)) void rendreCopie();
            }}
          >
            <Send size={16} aria-hidden="true" /> {envoi ? "Envoi…" : "Rendre ma copie"}
          </button>
        )}
      </div>
    </div>
  );
}
