"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { EtatFormulaire } from "@/components/study/formulaire";
import { clientUtilisateur } from "@/lib/supabase-serveur";
import { contexteApp, idRequete } from "@/lib/v6/contexte";
import { traduire } from "@/lib/v6/erreurs";

/**
 * Ateliers — E38 (actualité) et E39 (vérifier une réponse d'IA). Le
 * professeur choisit les sources ou le texte examiné ; aucune collecte web,
 * aucune note d'opinion, aucune détection de devoir « écrit par IA ».
 */

const uuid = z.string().uuid();

function sources(donnees: FormData) {
  const titres = donnees.getAll("source_titre").map(String);
  const auteurs = donnees.getAll("source_auteur").map(String);
  const dates = donnees.getAll("source_date").map(String);
  const urls = donnees.getAll("source_url").map(String);
  const extraits = donnees.getAll("source_extrait").map(String);
  return titres
    .map((t, i) => ({
      titre: t.trim().slice(0, 200),
      auteur: (auteurs[i] ?? "").trim().slice(0, 120),
      date: (dates[i] ?? "").trim(),
      url: /^https?:\/\//u.test((urls[i] ?? "").trim()) ? urls[i]!.trim().slice(0, 500) : "",
      extrait: (extraits[i] ?? "").trim().slice(0, 2000),
    }))
    .filter((s) => s.titre.length > 0);
}

export async function enregistrerAtelier(atelier: string | null, _p: EtatFormulaire, donnees: FormData): Promise<EtatFormulaire> {
  const kind = donnees.get("kind") === "verifier_ia" ? "verifier_ia" : "actualite";
  const valeurs = {
    kind,
    espace: String(donnees.get("espace") ?? ""),
    titre: String(donnees.get("titre") ?? "").trim(),
    question: String(donnees.get("question") ?? "").trim(),
    consigne: String(donnees.get("consigne") ?? "").trim(),
    texte: String(donnees.get("texte") ?? "").trim(),
    corrige: String(donnees.get("corrige") ?? "").trim(),
  };
  const liste = sources(donnees);
  const champs: Record<string, string[]> = {};
  if (!atelier && !uuid.safeParse(valeurs.espace).success) champs.espace = ["Choisissez le cours."];
  if (valeurs.titre.length < 3) champs.titre = ["Trois caractères au moins."];
  if (valeurs.question.length < 3) champs.question = ["La question guide l'atelier."];
  if (kind === "actualite" && liste.some((s) => !/^\d{4}-\d{2}-\d{2}$/u.test(s.date))) champs.sources = ["Chaque source doit être datée."];
  if (Object.keys(champs).length > 0) return { ok: false, message: "Certains champs sont à corriger.", champs, valeurs };

  const requestId = idRequete();
  const { jeton, personne } = await contexteApp();
  const client = clientUtilisateur(jeton);
  const ligne = {
    kind,
    titre: valeurs.titre.slice(0, 140),
    question: valeurs.question.slice(0, 1000),
    consigne: valeurs.consigne.slice(0, 4000) || null,
    sources: liste,
    texte_examine: kind === "verifier_ia" ? valeurs.texte.slice(0, 8000) || null : null,
  };
  let id = atelier;
  if (id) {
    const { error } = await client.from("ateliers").update(ligne).eq("id", id).eq("etat", "brouillon");
    if (error !== null) return { ok: false, message: traduire(error, requestId).message, requestId, valeurs };
  } else {
    const espace = await client.from("teaching_spaces").select("organization_id").eq("id", valeurs.espace).maybeSingle();
    if (espace.data === null) return { ok: false, message: "Ce contenu n'est pas accessible.", requestId, valeurs };
    const { data, error } = await client
      .from("ateliers")
      .insert({ ...ligne, organization_id: (espace.data as { organization_id: string }).organization_id, teaching_space_id: valeurs.espace, created_by: personne.profileId })
      .select("id")
      .single();
    if (error !== null) return { ok: false, message: traduire(error, requestId).message, requestId, valeurs };
    id = (data as { id: string }).id;
  }
  if (valeurs.corrige.length >= 3) {
    await client.from("ateliers_corriges").upsert({ atelier_id: id, corrige: valeurs.corrige.slice(0, 8000) });
  }
  revalidatePath("/app/prof/ateliers");
  redirect(`/app/prof/ateliers/${id}`);
}

export async function changerEtatAtelier(donnees: FormData): Promise<void> {
  const atelier = uuid.safeParse(String(donnees.get("atelier") ?? ""));
  if (!atelier.success) return;
  const { jeton } = await contexteApp();
  const { error } = await clientUtilisateur(jeton).rpc("atelier_etat", { p_atelier: atelier.data, p_etat: String(donnees.get("etat") ?? "") });
  revalidatePath(`/app/prof/ateliers/${atelier.data}`);
  if (error !== null) redirect(`/app/prof/ateliers/${atelier.data}?erreur=${encodeURIComponent(error.code === "23514" ? "sources" : "etat")}`);
}

export async function publierSynthese(atelier: string, _p: EtatFormulaire, donnees: FormData): Promise<EtatFormulaire> {
  const synthese = String(donnees.get("synthese") ?? "").trim().slice(0, 8000);
  const requestId = idRequete();
  const { jeton } = await contexteApp();
  const { error } = await clientUtilisateur(jeton).from("ateliers").update({ synthese: synthese || null }).eq("id", atelier);
  if (error !== null) return { ok: false, message: traduire(error, requestId).message, requestId, valeurs: { synthese } };
  revalidatePath(`/app/prof/ateliers/${atelier}`);
  return { ok: true, message: "Synthèse enregistrée.", valeurs: { synthese } };
}

export async function repondreAtelier(atelier: string, version: number, _p: EtatFormulaire, donnees: FormData): Promise<EtatFormulaire> {
  const passages = donnees.getAll("passage").map(String);
  const categories = donnees.getAll("categorie").map(String);
  const justifications = donnees.getAll("justification").map(String);
  const sourcesChoisies = donnees.getAll("source").map(String);
  const annotations = passages
    .map((p, i) => ({
      passage: p.trim().slice(0, 1000),
      affirmation: p.trim().slice(0, 1000),
      categorie: categories[i] ?? "",
      justification: (justifications[i] ?? "").trim().slice(0, 2000),
      source: sourcesChoisies[i] ? Number(sourcesChoisies[i]) : null,
    }))
    .filter((a) => a.passage.length > 0);
  const contestation = String(donnees.get("contestation") ?? "").trim();
  if (annotations.length === 0 && !contestation) return { ok: false, message: "Ajoute au moins une annotation." };
  const requestId = idRequete();
  const { jeton } = await contexteApp();
  const { data, error } = await clientUtilisateur(jeton).rpc("atelier_repondre", {
    p_atelier: atelier,
    p_annotations: annotations,
    p_contestation: contestation || null,
    p_version: version,
  });
  if (error !== null) return { ok: false, message: traduire(error, requestId).message, requestId };
  revalidatePath(`/app/ateliers/${atelier}`);
  return { ok: true, message: `Réponse enregistrée (version ${String(data)}).` };
}

/**
 * Assistant d'atelier (T05) — quatre étapes, brouillon enregistré à chacune :
 * 1. objectif (type, cours, titre, question) ; 2. sources datées (et texte
 * examiné) ; 3. consignes ; 4. corrigé, puis publication pour les élèves du
 * cours choisi. Les contrôles finaux (2 à 5 sources datées pour l'actualité,
 * texte requis pour « vérifier l'IA ») sont ceux de la base à la publication.
 */
export async function enregistrerEtape(atelier: string | null, etape: number, _p: EtatFormulaire, donnees: FormData): Promise<EtatFormulaire> {
  const requestId = idRequete();
  const { jeton, personne } = await contexteApp();
  const client = clientUtilisateur(jeton);
  const suite = (id: string, n: number) => redirect(`/app/prof/ateliers/${id}/assistant?etape=${n}`);

  if (etape === 1) {
    const kind = donnees.get("kind") === "verifier_ia" ? "verifier_ia" : "actualite";
    const valeurs = { kind, espace: String(donnees.get("espace") ?? ""), titre: String(donnees.get("titre") ?? "").trim(), question: String(donnees.get("question") ?? "").trim() };
    const champs: Record<string, string[]> = {};
    if (!atelier && !uuid.safeParse(valeurs.espace).success) champs.espace = ["Choisissez le cours et sa classe."];
    if (valeurs.titre.length < 3) champs.titre = ["Trois caractères au moins."];
    if (valeurs.question.length < 3) champs.question = ["La question guide l'atelier."];
    if (Object.keys(champs).length) return { ok: false, message: "Certains champs sont à corriger.", champs, valeurs };
    if (atelier) {
      const { error } = await client.from("ateliers").update({ titre: valeurs.titre.slice(0, 140), question: valeurs.question.slice(0, 1000) }).eq("id", atelier).eq("etat", "brouillon");
      if (error !== null) return { ok: false, message: traduire(error, requestId).message, requestId, valeurs };
      suite(atelier, 2);
    }
    const espace = await client.from("teaching_spaces").select("organization_id").eq("id", valeurs.espace).maybeSingle();
    if (espace.data === null) return { ok: false, message: "Ce contenu n'est pas accessible.", requestId, valeurs };
    const { data, error } = await client
      .from("ateliers")
      .insert({
        kind,
        titre: valeurs.titre.slice(0, 140),
        question: valeurs.question.slice(0, 1000),
        sources: [],
        organization_id: (espace.data as { organization_id: string }).organization_id,
        teaching_space_id: valeurs.espace,
        created_by: personne.profileId,
      })
      .select("id")
      .single();
    if (error !== null) return { ok: false, message: traduire(error, requestId).message, requestId, valeurs };
    revalidatePath("/app/prof/ateliers");
    suite((data as { id: string }).id, 2);
  }

  if (!atelier || !uuid.safeParse(atelier).success) return { ok: false, message: "Atelier introuvable.", requestId };
  const lu = await client.from("ateliers").select("kind, etat").eq("id", atelier).maybeSingle();
  const courant = lu.data as { kind: string; etat: string } | null;
  if (!courant) return { ok: false, message: "Ce contenu n'est pas accessible.", requestId };
  if (courant.etat !== "brouillon") return { ok: false, message: "Cet atelier est publié : il ne se modifie plus.", requestId };

  if (etape === 2) {
    const liste = sources(donnees);
    const texte = String(donnees.get("texte") ?? "").trim();
    const champs: Record<string, string[]> = {};
    if (liste.some((s) => !/^\d{4}-\d{2}-\d{2}$/u.test(s.date))) champs.sources = ["Chaque source doit être datée."];
    if (courant.kind === "actualite" && liste.length > 5) champs.sources = ["Cinq sources au plus."];
    if (courant.kind === "verifier_ia" && texte.length < 3) champs.texte = ["Collez la réponse à examiner."];
    if (Object.keys(champs).length) return { ok: false, message: "Certains champs sont à corriger.", champs, valeurs: { texte } };
    const { error } = await client
      .from("ateliers")
      .update({ sources: liste, texte_examine: courant.kind === "verifier_ia" ? texte.slice(0, 8000) : null })
      .eq("id", atelier)
      .eq("etat", "brouillon");
    if (error !== null) return { ok: false, message: traduire(error, requestId).message, requestId };
    suite(atelier, 3);
  }

  if (etape === 3) {
    const consigne = String(donnees.get("consigne") ?? "").trim().slice(0, 4000);
    const { error } = await client.from("ateliers").update({ consigne: consigne || null }).eq("id", atelier).eq("etat", "brouillon");
    if (error !== null) return { ok: false, message: traduire(error, requestId).message, requestId, valeurs: { consigne } };
    suite(atelier, 4);
  }

  // Étape 4 : corrigé, puis publication si demandée.
  const corrige = String(donnees.get("corrige") ?? "").trim();
  if (corrige.length >= 3) {
    const { error } = await client.from("ateliers_corriges").upsert({ atelier_id: atelier, corrige: corrige.slice(0, 8000) });
    if (error !== null) return { ok: false, message: traduire(error, requestId).message, requestId, valeurs: { corrige } };
  }
  if (donnees.get("intention") === "publier") {
    const { error } = await client.rpc("atelier_etat", { p_atelier: atelier, p_etat: "publie" });
    if (error !== null) {
      const message =
        error.code === "23514"
          ? courant.kind === "actualite"
            ? "Publication refusée : il faut entre 2 et 5 sources datées (étape 2)."
            : "Publication refusée : le texte à examiner manque (étape 2)."
          : traduire(error, requestId).message;
      return { ok: false, message, requestId, valeurs: { corrige } };
    }
    revalidatePath("/app/prof/ateliers");
    redirect(`/app/prof/ateliers/${atelier}?publie=1`);
  }
  revalidatePath(`/app/prof/ateliers/${atelier}`);
  return { ok: true, message: "Brouillon enregistré.", valeurs: { corrige } };
}
