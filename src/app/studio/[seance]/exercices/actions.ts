"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import type { EtatFormulaire } from "@/components/study/formulaire";
import { clientUtilisateur } from "@/lib/supabase-serveur";
import { contexteApp, idRequete } from "@/lib/v6/contexte";
import { traduire } from "@/lib/v6/erreurs";

/**
 * Banque d'exercices du Studio — dossier V6, §8.2, E21. Une version publiée
 * est figée : « modifier » crée la version suivante, les anciennes tentatives
 * gardent leur contexte. La correction va dans sa propre table, jamais lisible
 * par un élève avant sa tentative. RLS vérifie l'affectation à chaque écriture.
 */

const uuid = z.string().uuid();

function lireChoix(donnees: FormData): string[] {
  return donnees
    .getAll("choix")
    .map((c) => String(c).trim())
    .filter(Boolean)
    .slice(0, 8);
}

export async function creerExercice(seance: string, _p: EtatFormulaire, donnees: FormData): Promise<EtatFormulaire> {
  const kind = String(donnees.get("kind") ?? "qcm");
  const valeurs = {
    kind,
    enonce: String(donnees.get("enonce") ?? "").trim(),
    bonne: String(donnees.get("bonne") ?? "").trim(),
    tolerance: String(donnees.get("tolerance") ?? "0"),
    explication: String(donnees.get("explication") ?? "").trim(),
    indice: String(donnees.get("indice") ?? "").trim(),
    exemple: String(donnees.get("exemple") ?? "").trim(),
    notion: String(donnees.get("notion") ?? ""),
    nouvelleNotion: String(donnees.get("nouvelle_notion") ?? "").trim(),
    exercice: String(donnees.get("exercice") ?? ""),
  };
  const choix = lireChoix(donnees);
  const champs: Record<string, string[]> = {};
  if (!["qcm", "numerique", "texte"].includes(kind)) champs.kind = ["Type inconnu."];
  if (valeurs.enonce.length < 3) champs.enonce = ["Énoncé requis."];
  if (valeurs.explication.length < 3) champs.explication = ["L'explication est montrée après la réponse : elle est obligatoire."];
  if (kind === "qcm") {
    if (choix.length < 2) champs.choix = ["Deux choix au moins."];
    const i = Number(valeurs.bonne);
    if (!Number.isInteger(i) || i < 1 || i > choix.length) champs.bonne = ["Indique le numéro du bon choix."];
  }
  if (kind === "numerique" && !/^-?\d+([.,]\d+)?$/u.test(valeurs.bonne)) champs.bonne = ["Une valeur numérique."];
  if (Object.keys(champs).length > 0) return { ok: false, message: "Certains champs sont à corriger.", champs, valeurs: { ...valeurs, choix: choix.join("\n") } };

  const requestId = idRequete();
  const { jeton, personne } = await contexteApp();
  const client = clientUtilisateur(jeton);
  const lecon = await client.from("lessons").select("id, organization_id, teaching_space_id, chapter_id").eq("id", seance).maybeSingle();
  const l = lecon.data as { organization_id: string; teaching_space_id: string; chapter_id: string | null } | null;
  if (l === null) return { ok: false, message: "Ce contenu n'est pas accessible.", requestId };

  let notion: string | null = uuid.safeParse(valeurs.notion).success ? valeurs.notion : null;
  if (!notion && valeurs.nouvelleNotion.length >= 2) {
    const n = await client
      .from("notions")
      .insert({ organization_id: l.organization_id, teaching_space_id: l.teaching_space_id, chapter_id: l.chapter_id, label: valeurs.nouvelleNotion.slice(0, 120), created_by: personne.profileId })
      .select("id")
      .single();
    if (n.error !== null) return { ok: false, message: traduire(n.error, requestId).message, requestId, valeurs };
    notion = (n.data as { id: string }).id;
  }

  // Nouvelle version d'un exercice existant, ou nouvel exercice.
  let exercice = uuid.safeParse(valeurs.exercice).success ? valeurs.exercice : null;
  let numero = 1;
  if (exercice) {
    const derniere = await client.from("exercice_versions").select("version").eq("exercice_id", exercice).order("version", { ascending: false }).limit(1).maybeSingle();
    numero = ((derniere.data as { version: number } | null)?.version ?? 0) + 1;
    if (notion) await client.from("exercices").update({ notion_id: notion }).eq("id", exercice);
  } else {
    const e = await client
      .from("exercices")
      .insert({ organization_id: l.organization_id, teaching_space_id: l.teaching_space_id, lesson_id: seance, notion_id: notion, created_by: personne.profileId })
      .select("id")
      .single();
    if (e.error !== null) return { ok: false, message: traduire(e.error, requestId).message, requestId, valeurs };
    exercice = (e.data as { id: string }).id;
  }

  const v = await client
    .from("exercice_versions")
    .insert({
      organization_id: l.organization_id,
      exercice_id: exercice,
      version: numero,
      kind,
      enonce: valeurs.enonce.slice(0, 4000),
      choix: kind === "qcm" ? choix : null,
      created_by: personne.profileId,
    })
    .select("id")
    .single();
  if (v.error !== null) return { ok: false, message: traduire(v.error, requestId).message, requestId, valeurs };
  const version = (v.data as { id: string }).id;

  const bonne =
    kind === "qcm"
      ? { index: Number(valeurs.bonne) - 1 }
      : kind === "numerique"
        ? { valeur: Number(valeurs.bonne.replace(",", ".")), tolerance: Math.abs(Number(valeurs.tolerance.replace(",", ".")) || 0) }
        : null;
  const c = await client.from("exercice_corriges").insert({
    exercice_version_id: version,
    organization_id: l.organization_id,
    bonne_reponse: bonne,
    explication: valeurs.explication.slice(0, 4000),
    indice: valeurs.indice.slice(0, 2000) || null,
    exemple: valeurs.exemple.slice(0, 4000) || null,
    source_lesson_id: seance,
  });
  if (c.error !== null) return { ok: false, message: traduire(c.error, requestId).message, requestId, valeurs };

  if (donnees.get("publier") === "oui") {
    const p = await client.rpc("exercice_publier", { p_version: version });
    if (p.error !== null) return { ok: false, message: traduire(p.error, requestId).message, requestId };
  }
  revalidatePath(`/studio/${seance}/exercices`);
  return { ok: true, message: donnees.get("publier") === "oui" ? `Version ${numero} publiée.` : `Version ${numero} enregistrée en brouillon.` };
}

export async function publierVersion(donnees: FormData): Promise<void> {
  const version = uuid.safeParse(String(donnees.get("version") ?? ""));
  const seance = uuid.safeParse(String(donnees.get("seance") ?? ""));
  if (!version.success || !seance.success) return;
  const { jeton } = await contexteApp();
  await clientUtilisateur(jeton).rpc("exercice_publier", { p_version: version.data });
  revalidatePath(`/studio/${seance.data}/exercices`);
}

export async function archiverExercice(donnees: FormData): Promise<void> {
  const exercice = uuid.safeParse(String(donnees.get("exercice") ?? ""));
  const seance = uuid.safeParse(String(donnees.get("seance") ?? ""));
  if (!exercice.success || !seance.success) return;
  const { jeton } = await contexteApp();
  await clientUtilisateur(jeton).from("exercices").update({ archived_at: new Date().toISOString() }).eq("id", exercice.data);
  revalidatePath(`/studio/${seance.data}/exercices`);
}
