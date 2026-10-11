import { CopieCorrigee } from "@/components/evaluations/CopieCorrigee";
import { OngletCorrection } from "@/components/evaluations/OngletCorrection";
import { OngletEleves } from "@/components/evaluations/OngletEleves";
import { OngletResultats } from "@/components/evaluations/OngletResultats";
import { OngletSujet } from "@/components/evaluations/OngletSujet";
import { Passation } from "@/components/evaluations/Passation";
import { Coque } from "@/components/study/Coque";
import { analyser } from "@/lib/evaluations/analyse";
import { aleaDepuisGraine, genererCopie, type Corrige } from "@/lib/evaluations/sujet";
import type { ContexteApp } from "@/lib/v6/contexte";
import { cleCQ, type EvaluationProf, type LigneCopieCorrigee, type Suivi } from "@/lib/v6/evaluations";
import { CONTEXTE_FICTIF } from "../fictif";

/**
 * Aperçu de développement : les écrans d'évaluation avec des données
 * fictives, calculées par le vrai code (tirage, correction, analyse).
 * ?vue=sujet | eleves | correction | resultats | passation | copie
 */

const PROF: ContexteApp = {
  ...CONTEXTE_FICTIF,
  personne: { ...CONTEXTE_FICTIF.personne, prenom: "Claire", roles: ["professeur"] },
  roles: { eleve: false, professeur: true, admin: false, exploitant: false },
  chemin: "/professeur/evaluations",
};

const id = (n: number) => `00000000-0000-4000-8000-0000000e${String(n).padStart(4, "0")}`;
const N1 = id(901);
const N2 = id(902);

const PROF_FICTIF: EvaluationProf = {
  evaluation: {
    id: id(1),
    titre: "Contrôle — fonctions affines",
    coursId: id(2),
    mode: "classe",
    support: "en_ligne",
    notation: "les_deux",
    ouvreLe: "2026-10-12T06:00:00.000Z",
    fermeLe: "2026-10-12T07:00:00.000Z",
    dureeMinutes: 55,
    distribueeLe: "2026-10-11T18:00:00.000Z",
    resultatsPubliesLe: null,
    consigne: "Calculatrice autorisée. Justifie tes réponses rédigées.",
    melangerQuestions: true,
    melangerChoix: true,
  },
  questions: [
    { id: id(11), ordre: 1, kind: "qcm", enonce: "Quelle est l'image de 2 par f(x) = {a}x + {b} ?", choix: ["{2*a+b}", "{a+b}", "{2*a-b}", "{2+b}"], points: 2, notionId: N1, notion: "Images et antécédents", parametres: { a: { min: 2, max: 6 }, b: { min: 1, max: 9 } }, corrige: { index: 0 }, explication: "On remplace x par 2 : f(2) = 2a + b.", criteres: null },
    { id: id(12), ordre: 2, kind: "qcm_multiple", enonce: "Lesquelles sont des fonctions affines ?", choix: ["f(x) = 3x", "g(x) = x²", "h(x) = 2x + 1", "k(x) = 1/x"], points: 2, notionId: N2, notion: "Reconnaître une fonction affine", parametres: null, corrige: { indices: [0, 2] }, explication: "Une fonction affine s'écrit ax + b.", criteres: null },
    { id: id(13), ordre: 3, kind: "numerique", enonce: "Calcule f({c}) pour f(x) = {a}x − 1.", choix: null, points: 2, notionId: N1, notion: "Images et antécédents", parametres: { a: { min: 2, max: 5 }, c: { min: 2, max: 6 } }, corrige: { formule: "a*c-1", tolerance: 0 }, explication: null, criteres: null },
    { id: id(14), ordre: 4, kind: "redigee", enonce: "Explique comment lire l'image de 3 sur le graphique.", choix: null, points: 4, notionId: N1, notion: "Images et antécédents", parametres: null, corrige: {}, explication: null, criteres: "Part de 3 sur l'axe horizontal ; monte jusqu'à la droite ; lit l'ordonnée." },
  ],
  notions: [
    { id: N1, label: "Images et antécédents" },
    { id: N2, label: "Reconnaître une fonction affine" },
  ],
  amenagements: { [id(103)]: 1.33 },
};

const ELEVES = [
  ["Bernard", "Lina"],
  ["Diallo", "Hugo"],
  ["Exemple", "Camille"],
  ["Fictif", "Sami"],
  ["Martin", "Léa"],
  ["Petit", "Noé"],
].map(([nom, prenom], k) => ({ profileId: id(100 + k), nom: nom!, prenom: prenom! }));

/** Un faux déroulé : les élèves 0 à 4 rendent, avec des erreurs typiques ; le 5 est absent. */
function suiviFictif(publiee: boolean): Suivi {
  const corriges: Record<string, Corrige> = Object.fromEntries(PROF_FICTIF.questions.map((q) => [q.id, q.corrige]));
  const copies = ELEVES.map((e, k) => ({ ...genererCopie(PROF_FICTIF.questions, corriges, { melangerQuestions: true, melangerChoix: true }, aleaDepuisGraine(e.profileId)), e, k }));
  const reponses = new Map<string, Record<string, unknown>>();
  const corrections = new Map<string, { points: number; juste: boolean | null; automatique: boolean; commentaire: string | null }>();
  const attendus = new Map<string, { attendu: Record<string, unknown>; permutation: number[] | null }>();
  for (const c of copies) {
    const copieId = id(200 + c.k);
    for (const a of c.attendus) attendus.set(cleCQ(copieId, a.question_id), { attendu: a.attendu, permutation: a.permutation });
    if (c.k === 5) continue;
    for (const s of c.sujet) {
      const a = c.attendus.find((x) => x.question_id === s.question_id)!;
      const k = cleCQ(copieId, s.question_id);
      const q = PROF_FICTIF.questions.find((x) => x.id === s.question_id)!;
      if (s.kind === "qcm") {
        // Trois élèves confondent avec a + b (choix d'origine 1).
        const choisi = c.k % 2 === 0 ? (a.attendu.index as number) : a.permutation!.indexOf(1);
        reponses.set(k, { index: choisi });
        corrections.set(k, { points: choisi === a.attendu.index ? q.points : 0, juste: choisi === a.attendu.index, automatique: true, commentaire: null });
      } else if (s.kind === "qcm_multiple") {
        const indices = c.k < 3 ? (a.attendu.indices as number[]) : [(a.attendu.indices as number[])[0]!];
        reponses.set(k, { indices });
        const pts = c.k < 3 ? 2 : 1;
        corrections.set(k, { points: pts, juste: pts === 2, automatique: true, commentaire: null });
      } else if (s.kind === "numerique") {
        const juste = c.k !== 3;
        reponses.set(k, { valeur: String(juste ? a.attendu.valeur : Number(a.attendu.valeur) + 1) });
        corrections.set(k, { points: juste ? 2 : 0, juste, automatique: true, commentaire: null });
      } else {
        reponses.set(k, { texte: "On part de 3 sur l'axe des abscisses, on monte jusqu'à la droite et on lit la valeur sur l'axe des ordonnées." });
        if (c.k < 3) corrections.set(k, { points: c.k === 0 ? 4 : 3, juste: c.k === 0, automatique: false, commentaire: c.k === 0 ? null : "Précise que la valeur lue est l'image." });
      }
    }
  }
  const lesCopies = copies.map((c) => ({
    id: id(200 + c.k),
    profileId: c.e.profileId,
    sujet: c.sujet,
    commenceeLe: c.k === 5 ? null : "2026-10-12T06:02:00.000Z",
    limiteLe: c.k === 5 ? null : "2026-10-12T06:57:00.000Z",
    rendueLe: c.k === 5 ? null : "2026-10-12T06:50:00.000Z",
    sortiesOnglet: c.k === 3 ? 2 : 0,
  }));
  const analyse = analyser({
    questions: PROF_FICTIF.questions.map((q) => ({ id: q.id, ordre: q.ordre, kind: q.kind, enonce: q.enonce.replace(/\{[^}]+\}/g, "…"), choix: q.choix, points: q.points, notionId: q.notionId, notion: q.notion })),
    copies: lesCopies.map((c, k) => ({ id: c.id, profileId: c.profileId, prenom: ELEVES[k]!.prenom, nom: ELEVES[k]!.nom, commenceeLe: c.commenceeLe, rendueLe: c.rendueLe, sortiesOnglet: c.sortiesOnglet })),
    attendus: [...attendus].map(([k, v]) => ({ copieId: k.split("|")[0]!, questionId: k.split("|")[1]!, permutation: v.permutation })),
    reponses: [...reponses].map(([k, v]) => ({ copieId: k.split("|")[0]!, questionId: k.split("|")[1]!, reponse: v })),
    corrections: [...corrections].map(([k, v]) => ({ copieId: k.split("|")[0]!, questionId: k.split("|")[1]!, ...v })),
    support: "en_ligne",
  });
  void publiee;
  return { eleves: ELEVES, copies: lesCopies, reponses, corrections, attendus, photos: new Map(), analyse };
}

/** Une heure limite fictive, dans n minutes. */
function dansMinutes(n: number) {
  return new Date(Date.now() + n * 60000).toISOString();
}

export default async function ApercuEvaluations({ searchParams }: { searchParams: Promise<{ vue?: string }> }) {
  const vue = (await searchParams).vue ?? "resultats";
  const suivi = suiviFictif(false);

  if (vue === "passation" || vue === "copie") {
    const copie = suivi.copies[2]!;
    const lignes: LigneCopieCorrigee[] = copie.sujet.map((s) => {
      const k = cleCQ(copie.id, s.question_id);
      const q = PROF_FICTIF.questions.find((x) => x.id === s.question_id)!;
      const c = suivi.corrections.get(k);
      return {
        ordre: s.ordre,
        questionId: s.question_id,
        kind: s.kind,
        enonce: s.enonce,
        choix: s.choix,
        pointsMax: s.points,
        reponse: suivi.reponses.get(k) ?? null,
        attendu: suivi.attendus.get(k)?.attendu ?? null,
        points: c?.points ?? null,
        juste: c?.juste ?? null,
        commentaire: c?.commentaire ?? null,
        explication: q.explication,
        sourceLecon: null,
        sourceBloc: null,
        notionId: q.notionId,
        notion: q.notion,
      };
    });
    return (
      <Coque ctx={{ ...CONTEXTE_FICTIF, chemin: "/app/evaluations" }}>
        <div className="mx-auto max-w-[820px]">
          <p className="meta m-0 mb-3">Aperçu de développement · données fictives</p>
          <h1 className="titre-page">{PROF_FICTIF.evaluation.titre}</h1>
          <div className="mt-6">
            {vue === "passation" ? (
              <Passation
                evaluation={PROF_FICTIF.evaluation.id}
                titre={PROF_FICTIF.evaluation.titre}
                consigne={PROF_FICTIF.evaluation.consigne}
                dureeMinutes={55}
                dejaCommencee
                apercu={{ copieId: copie.id, sujet: copie.sujet, limiteLe: dansMinutes(23), rendueLe: null, reponses: { [copie.sujet[0]!.question_id]: suivi.reponses.get(cleCQ(copie.id, copie.sujet[0]!.question_id))! } }}
              />
            ) : (
              <CopieCorrigee titre={PROF_FICTIF.evaluation.titre} notation="les_deux" lignes={lignes} remiseANiveau={[id(990), id(991), id(992)]} photos={[]} />
            )}
          </div>
        </div>
      </Coque>
    );
  }

  return (
    <Coque ctx={PROF}>
      <p className="meta m-0 mb-3">Aperçu de développement · données fictives</p>
      <h1 className="titre-page">{PROF_FICTIF.evaluation.titre}</h1>
      <p className="meta m-0 mb-6 mt-1">Mathématiques — Seconde 2 · Contrôle en classe · 55 min par élève</p>
      {vue === "sujet" ? <OngletSujet prof={{ ...PROF_FICTIF, evaluation: { ...PROF_FICTIF.evaluation, distribueeLe: null } }} banque={[]} eleves={ELEVES.length} /> : null}
      {vue === "eleves" ? <OngletEleves prof={PROF_FICTIF} suivi={suivi} /> : null}
      {vue === "correction" ? <OngletCorrection prof={PROF_FICTIF} suivi={suivi} questionId={id(14)} /> : null}
      {vue === "resultats" ? <OngletResultats prof={PROF_FICTIF} suivi={suivi} /> : null}
    </Coque>
  );
}
