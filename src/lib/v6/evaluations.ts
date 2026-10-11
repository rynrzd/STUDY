import "server-only";

import { analyser, type Analyse } from "../evaluations/analyse.ts";
import type { Corrige, ElementSujet, GenreQuestion, Parametre } from "../evaluations/sujet.ts";
import { clientUtilisateur } from "../supabase-serveur.ts";

/**
 * Évaluations — lectures. Toutes sous le jeton de la personne : RLS décide
 * (corrigés et attendus au professeur de l'enseignement ; à l'élève, sa
 * copie, et ses points seulement après publication).
 */

export type ModeEvaluation = "classe" | "maison" | "diagnostique" | "flash";
export type Support = "en_ligne" | "papier";
export type Notation = "sur20" | "maitrise" | "les_deux";

export const LIBELLES_MODE: Readonly<Record<ModeEvaluation, string>> = {
  classe: "Contrôle en classe",
  maison: "À la maison",
  diagnostique: "Diagnostique",
  flash: "Éval flash",
};

export interface EvaluationResume {
  readonly id: string;
  readonly titre: string;
  readonly coursId: string;
  readonly mode: ModeEvaluation;
  readonly support: Support;
  readonly notation: Notation;
  readonly ouvreLe: string | null;
  readonly fermeLe: string | null;
  readonly dureeMinutes: number | null;
  readonly distribueeLe: string | null;
  readonly resultatsPubliesLe: string | null;
  readonly consigne: string | null;
  readonly melangerQuestions: boolean;
  readonly melangerChoix: boolean;
}

export type EtatEvaluation = "brouillon" | "programmee" | "ouverte" | "fermee" | "publiee";

export function etatEvaluation(e: EvaluationResume, maintenant = Date.now()): EtatEvaluation {
  if (e.resultatsPubliesLe) return "publiee";
  if (!e.distribueeLe) return "brouillon";
  if (e.ouvreLe && Date.parse(e.ouvreLe) > maintenant) return "programmee";
  if (e.fermeLe && Date.parse(e.fermeLe) <= maintenant) return "fermee";
  return "ouverte";
}

export const LIBELLES_ETAT: Readonly<Record<EtatEvaluation, string>> = {
  brouillon: "Brouillon",
  programmee: "Programmée",
  ouverte: "Ouverte",
  fermee: "À corriger",
  publiee: "Résultats publiés",
};

const COLONNES =
  "id, titre, teaching_space_id, mode, support, notation, ouvre_le, ferme_le, duree_minutes, distribuee_le, resultats_publies_le, consigne, melanger_questions, melanger_choix";

interface LigneEvaluation {
  id: string;
  titre: string;
  teaching_space_id: string;
  mode: ModeEvaluation;
  support: Support;
  notation: Notation;
  ouvre_le: string | null;
  ferme_le: string | null;
  duree_minutes: number | null;
  distribuee_le: string | null;
  resultats_publies_le: string | null;
  consigne: string | null;
  melanger_questions: boolean;
  melanger_choix: boolean;
}

const versResume = (l: LigneEvaluation): EvaluationResume => ({
  id: l.id,
  titre: l.titre,
  coursId: l.teaching_space_id,
  mode: l.mode,
  support: l.support,
  notation: l.notation,
  ouvreLe: l.ouvre_le,
  fermeLe: l.ferme_le,
  dureeMinutes: l.duree_minutes,
  distribueeLe: l.distribuee_le,
  resultatsPubliesLe: l.resultats_publies_le,
  consigne: l.consigne,
  melangerQuestions: l.melanger_questions,
  melangerChoix: l.melanger_choix,
});

/* -------------------------------------------------------------------------- */
/* Professeur                                                                   */
/* -------------------------------------------------------------------------- */

export interface EvaluationListee extends EvaluationResume {
  readonly copies: number;
  readonly rendues: number;
}

export async function evaluationsDuProfesseur(jeton: string): Promise<EvaluationListee[] | null> {
  const client = clientUtilisateur(jeton);
  const [evals, copies] = await Promise.all([
    client.from("evaluations").select(COLONNES).is("archived_at", null).order("created_at", { ascending: false }).limit(200),
    client.from("evaluation_copies").select("evaluation_id, rendue_le").limit(5000),
  ]);
  if (evals.error !== null) return null;
  const compte = new Map<string, { copies: number; rendues: number }>();
  for (const c of (copies.data ?? []) as { evaluation_id: string; rendue_le: string | null }[]) {
    const n = compte.get(c.evaluation_id) ?? { copies: 0, rendues: 0 };
    n.copies += 1;
    if (c.rendue_le) n.rendues += 1;
    compte.set(c.evaluation_id, n);
  }
  return ((evals.data ?? []) as LigneEvaluation[]).map((l) => ({ ...versResume(l), ...(compte.get(l.id) ?? { copies: 0, rendues: 0 }) }));
}

export interface QuestionProf {
  readonly id: string;
  readonly ordre: number;
  readonly kind: GenreQuestion;
  readonly enonce: string;
  readonly choix: string[] | null;
  readonly points: number;
  readonly notionId: string | null;
  readonly notion: string | null;
  readonly parametres: Record<string, Parametre> | null;
  readonly corrige: Corrige;
  readonly explication: string | null;
  readonly criteres: string | null;
}

export interface Notion {
  readonly id: string;
  readonly label: string;
}

export interface EvaluationProf {
  readonly evaluation: EvaluationResume;
  readonly questions: readonly QuestionProf[];
  readonly notions: readonly Notion[];
  readonly amenagements: Readonly<Record<string, number>>;
}

export async function evaluationDuProfesseur(jeton: string, id: string): Promise<EvaluationProf | null> {
  if (!/^[0-9a-f-]{36}$/iu.test(id)) return null;
  const client = clientUtilisateur(jeton);
  const { data, error } = await client.from("evaluations").select(COLONNES).eq("id", id).is("archived_at", null).maybeSingle();
  if (error !== null || data === null) return null;
  const evaluation = versResume(data as LigneEvaluation);
  const [questions, notions, amenagements] = await Promise.all([
    client
      .from("evaluation_questions")
      .select("id, ordre, kind, enonce, choix, points, notion_id, parametres, notions(label), evaluation_corriges(bonne_reponse, explication, criteres)")
      .eq("evaluation_id", id)
      .order("ordre"),
    client.from("notions").select("id, label").eq("teaching_space_id", evaluation.coursId).is("archived_at", null).order("label").limit(300),
    client.from("evaluation_amenagements").select("profile_id, coefficient").eq("evaluation_id", id),
  ]);
  type L = {
    id: string;
    ordre: number;
    kind: GenreQuestion;
    enonce: string;
    choix: string[] | null;
    points: number | string;
    notion_id: string | null;
    parametres: Record<string, Parametre> | null;
    notions: { label: string } | null;
    evaluation_corriges: { bonne_reponse: Corrige; explication: string | null; criteres: string | null } | { bonne_reponse: Corrige; explication: string | null; criteres: string | null }[] | null;
  };
  return {
    evaluation,
    questions: ((questions.data ?? []) as unknown as L[]).map((q) => {
      const c = Array.isArray(q.evaluation_corriges) ? q.evaluation_corriges[0] : q.evaluation_corriges;
      return {
        id: q.id,
        ordre: q.ordre,
        kind: q.kind,
        enonce: q.enonce,
        choix: q.choix,
        points: Number(q.points),
        notionId: q.notion_id,
        notion: q.notions?.label ?? null,
        parametres: q.parametres,
        corrige: c?.bonne_reponse ?? {},
        explication: c?.explication ?? null,
        criteres: c?.criteres ?? null,
      };
    }),
    notions: (notions.data ?? []) as Notion[],
    amenagements: Object.fromEntries(((amenagements.data ?? []) as { profile_id: string; coefficient: number | string }[]).map((a) => [a.profile_id, Number(a.coefficient)])),
  };
}

export interface EleveDeLEspace {
  readonly profileId: string;
  readonly prenom: string;
  readonly nom: string;
}

export async function elevesDeLEspace(jeton: string, cours: string): Promise<EleveDeLEspace[]> {
  const { data, error } = await clientUtilisateur(jeton).rpc("eleves_de_l_espace", { p_space: cours });
  if (error !== null) return [];
  return ((data ?? []) as { profile_id: string; prenom: string; nom: string }[]).map((e) => ({ profileId: e.profile_id, prenom: e.prenom, nom: e.nom }));
}

export interface CopieSuivie {
  readonly id: string;
  readonly profileId: string;
  readonly sujet: readonly ElementSujet[];
  readonly commenceeLe: string | null;
  readonly limiteLe: string | null;
  readonly rendueLe: string | null;
  readonly sortiesOnglet: number;
}

export interface Suivi {
  readonly eleves: readonly EleveDeLEspace[];
  readonly copies: readonly CopieSuivie[];
  readonly reponses: ReadonlyMap<string, Readonly<Record<string, unknown>>>;
  readonly corrections: ReadonlyMap<string, { points: number; juste: boolean | null; automatique: boolean; commentaire: string | null }>;
  readonly attendus: ReadonlyMap<string, { attendu: Readonly<Record<string, unknown>>; permutation: number[] | null }>;
  readonly photos: ReadonlyMap<string, readonly string[]>;
  readonly analyse: Analyse;
}

export const cleCQ = (copie: string, question: string) => `${copie}|${question}`;

/** Tout ce qu'il faut pour suivre, corriger et analyser une évaluation. */
export async function suiviEvaluation(jeton: string, prof: EvaluationProf): Promise<Suivi> {
  const client = clientUtilisateur(jeton);
  const id = prof.evaluation.id;
  const [eleves, copies] = await Promise.all([
    elevesDeLEspace(jeton, prof.evaluation.coursId),
    client.from("evaluation_copies").select("id, profile_id, sujet, commencee_le, limite_le, rendue_le, sorties_onglet").eq("evaluation_id", id).limit(500),
  ]);
  const lesCopies = ((copies.data ?? []) as {
    id: string;
    profile_id: string;
    sujet: ElementSujet[];
    commencee_le: string | null;
    limite_le: string | null;
    rendue_le: string | null;
    sorties_onglet: number;
  }[]).map((c) => ({ id: c.id, profileId: c.profile_id, sujet: c.sujet, commenceeLe: c.commencee_le, limiteLe: c.limite_le, rendueLe: c.rendue_le, sortiesOnglet: c.sorties_onglet }));
  const ids = lesCopies.map((c) => c.id);

  const vide = { data: [] as unknown[] };
  const [attendus, reponses, corrections, photos] = ids.length
    ? await Promise.all([
        client.from("evaluation_attendus").select("copie_id, question_id, attendu, permutation").in("copie_id", ids).limit(10000),
        client.from("evaluation_reponses").select("copie_id, question_id, reponse").in("copie_id", ids).limit(10000),
        client.from("evaluation_corrections").select("copie_id, question_id, points, juste, automatique, commentaire").in("copie_id", ids).limit(10000),
        client.from("evaluation_photos").select("copie_id, file_id, ordre").in("copie_id", ids).order("ordre").limit(2000),
      ])
    : [vide, vide, vide, vide];

  const lAttendus = (attendus.data ?? []) as { copie_id: string; question_id: string; attendu: Record<string, unknown>; permutation: number[] | null }[];
  const lReponses = (reponses.data ?? []) as { copie_id: string; question_id: string; reponse: Record<string, unknown> }[];
  const lCorrections = (corrections.data ?? []) as { copie_id: string; question_id: string; points: number | string; juste: boolean | null; automatique: boolean; commentaire: string | null }[];
  const lesPhotos = new Map<string, string[]>();
  for (const p of (photos.data ?? []) as { copie_id: string; file_id: string }[]) lesPhotos.set(p.copie_id, [...(lesPhotos.get(p.copie_id) ?? []), p.file_id]);

  const noms = new Map(eleves.map((e) => [e.profileId, e]));
  const analyse = analyser({
    questions: prof.questions.map((q) => ({ id: q.id, ordre: q.ordre, kind: q.kind, enonce: q.enonce, choix: q.choix, points: q.points, notionId: q.notionId, notion: q.notion })),
    copies: lesCopies.map((c) => ({
      id: c.id,
      profileId: c.profileId,
      prenom: noms.get(c.profileId)?.prenom ?? "Élève",
      nom: noms.get(c.profileId)?.nom ?? "",
      commenceeLe: c.commenceeLe,
      rendueLe: c.rendueLe,
      sortiesOnglet: c.sortiesOnglet,
    })),
    attendus: lAttendus.map((a) => ({ copieId: a.copie_id, questionId: a.question_id, permutation: a.permutation })),
    reponses: lReponses.map((r) => ({ copieId: r.copie_id, questionId: r.question_id, reponse: r.reponse })),
    corrections: lCorrections.map((c) => ({ copieId: c.copie_id, questionId: c.question_id, points: Number(c.points), juste: c.juste, automatique: c.automatique, commentaire: c.commentaire })),
    support: prof.evaluation.support,
  });

  return {
    eleves,
    copies: lesCopies,
    reponses: new Map(lReponses.map((r) => [cleCQ(r.copie_id, r.question_id), r.reponse])),
    corrections: new Map(lCorrections.map((c) => [cleCQ(c.copie_id, c.question_id), { points: Number(c.points), juste: c.juste, automatique: c.automatique, commentaire: c.commentaire }])),
    attendus: new Map(lAttendus.map((a) => [cleCQ(a.copie_id, a.question_id), { attendu: a.attendu, permutation: a.permutation }])),
    photos: lesPhotos,
    analyse,
  };
}

export interface ExerciceDeBanque {
  readonly versionId: string;
  readonly kind: "qcm" | "numerique" | "texte";
  readonly enonce: string;
  readonly notion: string | null;
}

/** Les exercices publiés de la banque pour cet enseignement, à importer. */
export async function banquePourEvaluation(jeton: string, cours: string): Promise<ExerciceDeBanque[]> {
  const { data, error } = await clientUtilisateur(jeton)
    .from("exercices")
    .select("id, notions(label), exercice_versions(id, version, kind, enonce, published_at)")
    .eq("teaching_space_id", cours)
    .is("archived_at", null)
    .limit(300);
  if (error !== null) return [];
  const sortie: ExerciceDeBanque[] = [];
  for (const e of (data ?? []) as unknown as { notions: { label: string } | null; exercice_versions: { id: string; version: number; kind: "qcm" | "numerique" | "texte"; enonce: string; published_at: string | null }[] }[]) {
    const v = [...(e.exercice_versions ?? [])].filter((x) => x.published_at).sort((a, b) => b.version - a.version)[0];
    if (v) sortie.push({ versionId: v.id, kind: v.kind, enonce: v.enonce, notion: e.notions?.label ?? null });
  }
  return sortie;
}

/* -------------------------------------------------------------------------- */
/* Élève                                                                        */
/* -------------------------------------------------------------------------- */

export interface EvaluationEleve extends EvaluationResume {
  readonly copieId: string | null;
  readonly commenceeLe: string | null;
  readonly limiteLe: string | null;
  readonly rendueLe: string | null;
  readonly sujet: readonly ElementSujet[];
}

export async function evaluationsDeLEleve(jeton: string, moi: string): Promise<EvaluationEleve[] | null> {
  const client = clientUtilisateur(jeton);
  const [evals, copies] = await Promise.all([
    client.from("evaluations").select(COLONNES).not("distribuee_le", "is", null).is("archived_at", null).order("created_at", { ascending: false }).limit(100),
    client.from("evaluation_copies").select("id, evaluation_id, commencee_le, limite_le, rendue_le").eq("profile_id", moi).limit(200),
  ]);
  if (evals.error !== null) return null;
  const parEval = new Map(((copies.data ?? []) as { id: string; evaluation_id: string; commencee_le: string | null; limite_le: string | null; rendue_le: string | null }[]).map((c) => [c.evaluation_id, c]));
  return ((evals.data ?? []) as LigneEvaluation[]).map((l) => {
    const c = parEval.get(l.id);
    return { ...versResume(l), copieId: c?.id ?? null, commenceeLe: c?.commencee_le ?? null, limiteLe: c?.limite_le ?? null, rendueLe: c?.rendue_le ?? null, sujet: [] };
  });
}

export async function evaluationDeLEleve(jeton: string, moi: string, id: string): Promise<EvaluationEleve | null> {
  if (!/^[0-9a-f-]{36}$/iu.test(id)) return null;
  const client = clientUtilisateur(jeton);
  const [ev, copie] = await Promise.all([
    client.from("evaluations").select(COLONNES).eq("id", id).maybeSingle(),
    client.from("evaluation_copies").select("id, sujet, commencee_le, limite_le, rendue_le").eq("evaluation_id", id).eq("profile_id", moi).maybeSingle(),
  ]);
  if (ev.error !== null || ev.data === null || copie.data === null) return null;
  const c = copie.data as { id: string; sujet: ElementSujet[]; commencee_le: string | null; limite_le: string | null; rendue_le: string | null };
  return { ...versResume(ev.data as LigneEvaluation), copieId: c.id, commenceeLe: c.commencee_le, limiteLe: c.limite_le, rendueLe: c.rendue_le, sujet: c.sujet };
}

export interface LigneCopieCorrigee {
  readonly ordre: number;
  readonly questionId: string;
  readonly kind: GenreQuestion;
  readonly enonce: string;
  readonly choix: string[] | null;
  readonly pointsMax: number;
  readonly reponse: Readonly<Record<string, unknown>> | null;
  readonly attendu: Readonly<Record<string, unknown>> | null;
  readonly points: number | null;
  readonly juste: boolean | null;
  readonly commentaire: string | null;
  readonly explication: string | null;
  readonly sourceLecon: string | null;
  readonly sourceBloc: string | null;
  readonly notionId: string | null;
  readonly notion: string | null;
}

export async function maCopieCorrigee(jeton: string, id: string): Promise<LigneCopieCorrigee[] | null> {
  const { data, error } = await clientUtilisateur(jeton).rpc("evaluation_ma_copie", { p_eval: id });
  if (error !== null) return null;
  return ((data ?? []) as {
    ordre: number;
    question_id: string;
    kind: GenreQuestion;
    enonce: string;
    choix: string[] | null;
    points_max: number | string;
    reponse: Record<string, unknown> | null;
    attendu: Record<string, unknown> | null;
    points: number | string | null;
    juste: boolean | null;
    commentaire: string | null;
    explication: string | null;
    source_lesson_id: string | null;
    source_block_id: string | null;
    notion_id: string | null;
    notion: string | null;
  }[]).map((l) => ({
    ordre: l.ordre,
    questionId: l.question_id,
    kind: l.kind,
    enonce: l.enonce,
    choix: l.choix,
    pointsMax: Number(l.points_max),
    reponse: l.reponse,
    attendu: l.attendu,
    points: l.points === null ? null : Number(l.points),
    juste: l.juste,
    commentaire: l.commentaire,
    explication: l.explication,
    sourceLecon: l.source_lesson_id,
    sourceBloc: l.source_block_id,
    notionId: l.notion_id,
    notion: l.notion,
  }));
}

/** Pour la remise à niveau : les exercices publiés des notions ratées, dans cet enseignement. */
export async function exercicesDesNotions(jeton: string, cours: string, notions: readonly string[]): Promise<string[]> {
  if (notions.length === 0) return [];
  const { data, error } = await clientUtilisateur(jeton)
    .from("exercices")
    .select("id, exercice_versions(id, version, published_at)")
    .eq("teaching_space_id", cours)
    .in("notion_id", [...notions])
    .is("archived_at", null)
    .limit(60);
  if (error !== null) return [];
  return ((data ?? []) as unknown as { exercice_versions: { id: string; version: number; published_at: string | null }[] }[])
    .map((e) => [...(e.exercice_versions ?? [])].filter((v) => v.published_at).sort((a, b) => b.version - a.version)[0]?.id)
    .filter((v): v is string => Boolean(v))
    .slice(0, 12);
}
