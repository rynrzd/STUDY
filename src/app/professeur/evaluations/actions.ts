"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { deposerPieceJointe, retirerPieceJointe } from "@/lib/documents";
import { parisVersIso } from "@/lib/evaluations/dates";
import { messageEvaluation } from "@/lib/evaluations/messages";
import { aleaDepuisGraine, genererCopie, problemeQuestion, type Corrige, type GenreQuestion, type Parametre } from "@/lib/evaluations/sujet";
import { jetonAccesDe, sessionCourante } from "@/lib/session-serveur";
import { clientUtilisateur } from "@/lib/supabase-serveur";
import { elevesDeLEspace, evaluationDuProfesseur } from "@/lib/v6/evaluations";

/**
 * Actions du professeur sur une évaluation. L'identité vient de la session ;
 * chaque écriture repasse par RLS ou par une fonction qui revérifie que la
 * personne enseigne bien dans ce cours.
 */

export interface EtatAction {
  readonly ok: boolean;
  readonly message: string;
}

const uuid = z.string().uuid();
const chemin = (id: string) => `/professeur/evaluations/${id}`;

async function session() {
  const personne = await sessionCourante();
  if (personne === null) redirect("/connexion");
  const jeton = await jetonAccesDe(personne);
  if (jeton === null) redirect("/connexion");
  return { personne, jeton, client: clientUtilisateur(jeton) };
}

const texte = (d: FormData, nom: string) => String(d.get(nom) ?? "").trim();
// Les champs datetime-local sont à l'heure de Paris ; le serveur, lui, est en UTC.
const dateOuNull = (v: string) => parisVersIso(v);

/* -------------------------------------------------------------------------- */
/* Créer et régler                                                              */
/* -------------------------------------------------------------------------- */

const schemaCreation = z.object({
  cours: uuid,
  titre: z.string().trim().min(3, "Un titre d'au moins 3 caractères.").max(140),
  mode: z.enum(["classe", "maison", "diagnostique", "flash"]),
  support: z.enum(["en_ligne", "papier"]),
  notation: z.enum(["sur20", "maitrise", "les_deux"]),
});

export async function creerEvaluation(_e: EtatAction | null, donnees: FormData): Promise<EtatAction> {
  const analyse = schemaCreation.safeParse(Object.fromEntries(["cours", "titre", "mode", "support", "notation"].map((k) => [k, texte(donnees, k)])));
  if (!analyse.success) return { ok: false, message: analyse.error.issues[0]?.message ?? "Formulaire incomplet." };
  const { personne, client } = await session();
  const espace = await client.from("teaching_spaces").select("organization_id").eq("id", analyse.data.cours).maybeSingle();
  if (espace.data === null) return { ok: false, message: "Ce cours n'est pas accessible." };
  const duree = { classe: 55, maison: null, diagnostique: 20, flash: 5 }[analyse.data.mode];
  const { data, error } = await client
    .from("evaluations")
    .insert({
      organization_id: (espace.data as { organization_id: string }).organization_id,
      teaching_space_id: analyse.data.cours,
      titre: analyse.data.titre,
      mode: analyse.data.mode,
      support: analyse.data.support,
      notation: analyse.data.notation,
      duree_minutes: analyse.data.support === "papier" ? null : duree,
      created_by: personne.profileId,
    })
    .select("id")
    .single();
  if (error !== null || data === null) return { ok: false, message: messageEvaluation(error) };
  redirect(chemin((data as { id: string }).id));
}

export async function enregistrerReglages(_e: EtatAction | null, donnees: FormData): Promise<EtatAction> {
  const id = texte(donnees, "evaluation");
  if (!uuid.safeParse(id).success) return { ok: false, message: "Évaluation inconnue." };
  const ouvre = dateOuNull(texte(donnees, "ouvre_le"));
  const ferme = dateOuNull(texte(donnees, "ferme_le"));
  if (ouvre && ferme && ferme <= ouvre) return { ok: false, message: "La fermeture doit suivre l'ouverture." };
  const duree = texte(donnees, "duree_minutes");
  const dureeMinutes = duree === "" ? null : Number(duree);
  if (dureeMinutes !== null && (!Number.isInteger(dureeMinutes) || dureeMinutes < 1 || dureeMinutes > 600)) {
    return { ok: false, message: "Une durée entre 1 et 600 minutes, ou aucune." };
  }
  const titre = texte(donnees, "titre");
  if (titre.length < 3) return { ok: false, message: "Un titre d'au moins 3 caractères." };
  const notation = texte(donnees, "notation");
  const { client } = await session();
  const { error } = await client
    .from("evaluations")
    .update({
      titre: titre.slice(0, 140),
      consigne: texte(donnees, "consigne").slice(0, 4000) || null,
      ouvre_le: ouvre,
      ferme_le: ferme,
      duree_minutes: dureeMinutes,
      melanger_questions: donnees.get("melanger_questions") === "on",
      melanger_choix: donnees.get("melanger_choix") === "on",
      ...(["sur20", "maitrise", "les_deux"].includes(notation) ? { notation } : {}),
      updated_at: new Date().toISOString(),
    })
    .eq("id", id);
  if (error !== null) return { ok: false, message: messageEvaluation(error) };
  revalidatePath(chemin(id));
  return { ok: true, message: "Réglages enregistrés." };
}

/* -------------------------------------------------------------------------- */
/* Questions                                                                    */
/* -------------------------------------------------------------------------- */

/** « a: 2..9 ; b: -5..5 non nul » → paramètres de variantes. */
function lireParametres(source: string): Record<string, Parametre> | null {
  const sortie: Record<string, Parametre> = {};
  for (const morceau of source.split(/[;\n]/).map((m) => m.trim()).filter(Boolean)) {
    const m = /^([a-zA-Z_]\w*)\s*[:=]\s*(-?\d+)\s*(?:\.\.|à|-)\s*(-?\d+)\s*(non\s*nul)?$/i.exec(morceau);
    if (!m) throw new Error(`Variante illisible : « ${morceau} ». Écrivez par exemple « a: 2..9 ».`);
    sortie[m[1]!] = { min: Number(m[2]), max: Number(m[3]), ...(m[4] ? { nonNul: true } : {}) };
  }
  return Object.keys(sortie).length ? sortie : null;
}

const lignes = (v: string) => v.split("\n").map((l) => l.trim()).filter(Boolean);

export async function ajouterQuestion(_e: EtatAction | null, donnees: FormData): Promise<EtatAction> {
  const id = texte(donnees, "evaluation");
  const kind = texte(donnees, "kind") as GenreQuestion;
  if (!uuid.safeParse(id).success || !["qcm", "qcm_multiple", "vrai_faux", "numerique", "courte", "redigee"].includes(kind)) {
    return { ok: false, message: "Type de question inconnu." };
  }
  const enonce = texte(donnees, "enonce");
  if (enonce.length < 3) return { ok: false, message: "Écrivez l'énoncé." };
  const points = Number(texte(donnees, "points").replace(",", ".") || "1");
  if (!(points > 0 && points <= 100)) return { ok: false, message: "Des points entre 0,5 et 100." };

  let parametres: Record<string, Parametre> | null;
  try {
    parametres = lireParametres(texte(donnees, "parametres"));
  } catch (e) {
    return { ok: false, message: e instanceof Error ? e.message : "Variantes illisibles." };
  }

  const choix = kind === "qcm" || kind === "qcm_multiple" ? lignes(texte(donnees, "choix")) : null;
  if (choix && (choix.length < 2 || choix.length > 8)) return { ok: false, message: "Entre 2 et 8 choix, un par ligne." };
  const bonnes = donnees.getAll("bonne").map(Number).filter((n) => Number.isInteger(n));
  const corrige: Corrige =
    kind === "qcm"
      ? { index: bonnes[0] ?? -1 }
      : kind === "qcm_multiple"
        ? { indices: bonnes }
        : kind === "vrai_faux"
          ? { vrai: texte(donnees, "vrai") === "vrai" }
          : kind === "numerique"
            ? (() => {
                const v = texte(donnees, "valeur").replace(",", ".");
                const tolerance = Number(texte(donnees, "tolerance").replace(",", ".") || "0");
                return /^-?\d+(\.\d+)?$/.test(v) ? { valeur: Number(v), tolerance } : { formule: v, tolerance };
              })()
            : kind === "courte"
              ? { acceptees: lignes(texte(donnees, "acceptees")) }
              : {};

  const probleme = problemeQuestion({ id: "verification", kind, enonce, choix, points, parametres }, corrige);
  if (probleme) return { ok: false, message: probleme };

  const { client } = await session();
  const ev = await client.from("evaluations").select("organization_id, distribuee_le").eq("id", id).maybeSingle();
  if (ev.data === null) return { ok: false, message: "Évaluation inaccessible." };
  const { organization_id: org } = ev.data as { organization_id: string };
  const dernier = await client.from("evaluation_questions").select("ordre").eq("evaluation_id", id).order("ordre", { ascending: false }).limit(1);
  const ordre = (((dernier.data ?? [])[0] as { ordre: number } | undefined)?.ordre ?? 0) + 1;
  const notion = texte(donnees, "notion");

  const q = await client
    .from("evaluation_questions")
    .insert({ organization_id: org, evaluation_id: id, ordre, kind, enonce, choix, points, notion_id: uuid.safeParse(notion).success ? notion : null, parametres })
    .select("id")
    .single();
  if (q.error !== null || q.data === null) return { ok: false, message: messageEvaluation(q.error) };
  const c = await client.from("evaluation_corriges").insert({
    question_id: (q.data as { id: string }).id,
    organization_id: org,
    bonne_reponse: corrige,
    explication: texte(donnees, "explication").slice(0, 4000) || null,
    criteres: texte(donnees, "criteres").slice(0, 2000) || null,
  });
  if (c.error !== null) {
    await client.from("evaluation_questions").delete().eq("id", (q.data as { id: string }).id);
    return { ok: false, message: messageEvaluation(c.error) };
  }
  revalidatePath(chemin(id));
  return { ok: true, message: `Question ${ordre} ajoutée.` };
}

export async function supprimerQuestion(donnees: FormData): Promise<void> {
  const id = texte(donnees, "evaluation");
  const question = texte(donnees, "question");
  if (!uuid.safeParse(id).success || !uuid.safeParse(question).success) return;
  const { client } = await session();
  await client.from("evaluation_questions").delete().eq("id", question).eq("evaluation_id", id);
  revalidatePath(chemin(id));
}

/** Importe des exercices publiés de la banque : énoncé, choix, corrigé et explication. */
export async function importerExercices(_e: EtatAction | null, donnees: FormData): Promise<EtatAction> {
  const id = texte(donnees, "evaluation");
  const versions = donnees.getAll("version").map(String).filter((v) => uuid.safeParse(v).success).slice(0, 40);
  if (!uuid.safeParse(id).success || versions.length === 0) return { ok: false, message: "Cochez au moins un exercice." };
  const { client } = await session();
  const ev = await client.from("evaluations").select("organization_id").eq("id", id).maybeSingle();
  if (ev.data === null) return { ok: false, message: "Évaluation inaccessible." };
  const org = (ev.data as { organization_id: string }).organization_id;
  const [lus, dernier] = await Promise.all([
    client
      .from("exercice_versions")
      .select("id, kind, enonce, choix, exercices(notion_id), exercice_corriges(bonne_reponse, explication, source_lesson_id, source_block_id)")
      .in("id", versions),
    client.from("evaluation_questions").select("ordre").eq("evaluation_id", id).order("ordre", { ascending: false }).limit(1),
  ]);
  let ordre = (((dernier.data ?? [])[0] as { ordre: number } | undefined)?.ordre ?? 0);
  let importes = 0;
  type V = {
    id: string;
    kind: "qcm" | "numerique" | "texte";
    enonce: string;
    choix: string[] | null;
    exercices: { notion_id: string | null } | null;
    exercice_corriges: { bonne_reponse: Corrige | null; explication: string; source_lesson_id: string | null; source_block_id: string | null } | { bonne_reponse: Corrige | null; explication: string; source_lesson_id: string | null; source_block_id: string | null }[] | null;
  };
  for (const v of (lus.data ?? []) as unknown as V[]) {
    const c = Array.isArray(v.exercice_corriges) ? v.exercice_corriges[0] : v.exercice_corriges;
    const kind: GenreQuestion = v.kind === "texte" ? "redigee" : v.kind;
    const q = await client
      .from("evaluation_questions")
      .insert({ organization_id: org, evaluation_id: id, ordre: ++ordre, kind, enonce: v.enonce, choix: v.choix, points: 1, notion_id: v.exercices?.notion_id ?? null, exercice_version_id: v.id })
      .select("id")
      .single();
    if (q.error !== null || q.data === null) return { ok: false, message: messageEvaluation(q.error) };
    await client.from("evaluation_corriges").insert({
      question_id: (q.data as { id: string }).id,
      organization_id: org,
      bonne_reponse: kind === "redigee" ? {} : (c?.bonne_reponse ?? {}),
      explication: c?.explication ?? null,
      source_lesson_id: c?.source_lesson_id ?? null,
      source_block_id: c?.source_block_id ?? null,
    });
    importes += 1;
  }
  revalidatePath(chemin(id));
  return { ok: true, message: `${importes} exercice${importes > 1 ? "s" : ""} importé${importes > 1 ? "s" : ""}.` };
}

/* -------------------------------------------------------------------------- */
/* Élèves : aménagements, distribution                                          */
/* -------------------------------------------------------------------------- */

export async function definirAmenagement(donnees: FormData): Promise<void> {
  const id = texte(donnees, "evaluation");
  const eleve = texte(donnees, "eleve");
  const coefficient = texte(donnees, "coefficient");
  if (!uuid.safeParse(id).success || !uuid.safeParse(eleve).success) return;
  const { client } = await session();
  if (!["1.33", "1.5", "2"].includes(coefficient)) {
    await client.from("evaluation_amenagements").delete().eq("evaluation_id", id).eq("profile_id", eleve);
  } else {
    const ev = await client.from("evaluations").select("organization_id").eq("id", id).maybeSingle();
    if (ev.data === null) return;
    await client
      .from("evaluation_amenagements")
      .upsert({ evaluation_id: id, profile_id: eleve, organization_id: (ev.data as { organization_id: string }).organization_id, coefficient: Number(coefficient) });
  }
  revalidatePath(chemin(id));
}

/**
 * Distribue : un sujet tiré pour chaque élève (ordre, choix, valeurs), avec
 * son attendu. Les élèves arrivés après une première distribution reçoivent
 * leur copie à la suivante ; les autres gardent la leur.
 */
export async function distribuer(_e: EtatAction | null, donnees: FormData): Promise<EtatAction> {
  const id = texte(donnees, "evaluation");
  if (!uuid.safeParse(id).success) return { ok: false, message: "Évaluation inconnue." };
  const { jeton, client } = await session();
  const prof = await evaluationDuProfesseur(jeton, id);
  if (prof === null) return { ok: false, message: "Évaluation inaccessible." };
  if (prof.questions.length === 0) return { ok: false, message: "Ajoutez au moins une question." };
  for (const q of prof.questions) {
    const p = problemeQuestion(q, q.corrige);
    if (p) return { ok: false, message: `Question ${q.ordre} : ${p}` };
  }
  const eleves = await elevesDeLEspace(jeton, prof.evaluation.coursId);
  if (eleves.length === 0) return { ok: false, message: "Aucun élève dans ce cours." };
  const corriges = Object.fromEntries(prof.questions.map((q) => [q.id, q.corrige]));
  const copies = eleves.map((e) => {
    const { sujet, attendus } = genererCopie(
      prof.questions,
      corriges,
      { melangerQuestions: prof.evaluation.melangerQuestions, melangerChoix: prof.evaluation.melangerChoix },
      aleaDepuisGraine(randomUUID()),
    );
    return { profile_id: e.profileId, sujet, attendus };
  });
  const { data, error } = await client.rpc("evaluation_distribuer", { p_eval: id, p_copies: copies });
  if (error !== null) return { ok: false, message: messageEvaluation(error) };
  revalidatePath(chemin(id));
  revalidatePath("/professeur/evaluations");
  const n = Number(data);
  return { ok: true, message: n === 0 ? "Toutes les copies étaient déjà distribuées." : `${n} copie${n > 1 ? "s" : ""} distribuée${n > 1 ? "s" : ""}, chacune avec son sujet.` };
}

/* -------------------------------------------------------------------------- */
/* Correction                                                                   */
/* -------------------------------------------------------------------------- */

export async function noter(_e: EtatAction | null, donnees: FormData): Promise<EtatAction> {
  const id = texte(donnees, "evaluation");
  const copie = texte(donnees, "copie");
  const question = texte(donnees, "question");
  if (![id, copie, question].every((v) => uuid.safeParse(v).success)) return { ok: false, message: "Copie inconnue." };
  // Un bouton rapide (0, moitié, maximum) l'emporte sur le champ saisi.
  const brut = (texte(donnees, "rapide") || texte(donnees, "points")).replace(",", ".");
  const points = brut === "" ? null : Number(brut);
  if (points !== null && !Number.isFinite(points)) return { ok: false, message: "Des points en nombre." };
  const { client } = await session();
  const { error } = await client.rpc("evaluation_noter", { p_copie: copie, p_question: question, p_points: points, p_commentaire: texte(donnees, "commentaire") || null });
  if (error !== null) return { ok: false, message: messageEvaluation(error) };
  revalidatePath(chemin(id));
  return { ok: true, message: "Enregistré." };
}

/** Papier : la réponse cochée ou écrite par l'élève, corrigée aussitôt. */
export async function saisirReponse(donnees: FormData): Promise<void> {
  const id = texte(donnees, "evaluation");
  const copie = texte(donnees, "copie");
  const question = texte(donnees, "question");
  if (![id, copie, question].every((v) => uuid.safeParse(v).success)) return;
  let reponse: Record<string, unknown>;
  try {
    reponse = JSON.parse(texte(donnees, "reponse")) as Record<string, unknown>;
  } catch {
    return;
  }
  const { client } = await session();
  await client.rpc("evaluation_saisir_reponse", { p_copie: copie, p_question: question, p_reponse: reponse });
  revalidatePath(chemin(id));
}

export async function deposerPhoto(_e: EtatAction | null, donnees: FormData): Promise<EtatAction> {
  const id = texte(donnees, "evaluation");
  const copie = texte(donnees, "copie");
  const fichier = donnees.get("photo");
  if (!uuid.safeParse(id).success || !uuid.safeParse(copie).success) return { ok: false, message: "Copie inconnue." };
  if (!(fichier instanceof File) || fichier.size === 0) return { ok: false, message: "Choisissez une photo de la copie." };
  const { personne, jeton, client } = await session();
  const cp = await client.from("evaluation_copies").select("organization_id").eq("id", copie).maybeSingle();
  if (cp.data === null) return { ok: false, message: "Copie inaccessible." };
  const depot = await deposerPieceJointe({
    jeton,
    organisation: (cp.data as { organization_id: string }).organization_id,
    proprietaire: personne.profileId,
    genre: "copie_evaluation",
    rattachement: copie,
    fichier,
  });
  if (depot.etat !== "ok") return { ok: false, message: depot.message };
  const dernier = await client.from("evaluation_photos").select("ordre").eq("copie_id", copie).order("ordre", { ascending: false }).limit(1);
  const { error } = await client.from("evaluation_photos").insert({
    copie_id: copie,
    file_id: depot.support.fileId,
    organization_id: (cp.data as { organization_id: string }).organization_id,
    ordre: (((dernier.data ?? [])[0] as { ordre: number } | undefined)?.ordre ?? 0) + 1,
  });
  if (error !== null) {
    await retirerPieceJointe(jeton, depot.support.fileId);
    return { ok: false, message: messageEvaluation(error) };
  }
  revalidatePath(chemin(id));
  return { ok: true, message: "Photo ajoutée à la copie." };
}

export async function publierResultats(_e: EtatAction | null, donnees: FormData): Promise<EtatAction> {
  const id = texte(donnees, "evaluation");
  if (!uuid.safeParse(id).success) return { ok: false, message: "Évaluation inconnue." };
  const { client } = await session();
  const { data, error } = await client.rpc("evaluation_publier_resultats", { p_eval: id });
  if (error !== null) return { ok: false, message: messageEvaluation(error) };
  revalidatePath(chemin(id));
  revalidatePath("/professeur/evaluations");
  const n = Number(data);
  return { ok: true, message: `Résultats publiés. ${n} notion${n > 1 ? "s" : ""} remise${n > 1 ? "s" : ""} « à revoir » dans la révision des élèves.` };
}

export async function archiverEvaluation(donnees: FormData): Promise<void> {
  const id = texte(donnees, "evaluation");
  if (!uuid.safeParse(id).success) return;
  const { client } = await session();
  await client.from("evaluations").update({ archived_at: new Date().toISOString() }).eq("id", id);
  revalidatePath("/professeur/evaluations");
  redirect("/professeur/evaluations");
}
