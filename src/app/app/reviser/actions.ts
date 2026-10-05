"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { EtatFormulaire } from "@/components/study/formulaire";
import { clientUtilisateur } from "@/lib/supabase-serveur";
import { reveiller } from "@/lib/travaux";
import { contexteApp, idRequete } from "@/lib/v6/contexte";
import { traduire, type CodeErreur } from "@/lib/v6/erreurs";

/**
 * Révisions — E04 à E08, E23, E40. La génération est un travail persistant :
 * l'élève peut quitter la page, la fiche l'attend. Les tentatives sont
 * corrigées par la base et ne progressent qu'une fois par identifiant client.
 */

const uuid = z.string().uuid();

export async function creerFiche(_p: EtatFormulaire, donnees: FormData): Promise<EtatFormulaire> {
  const lecons = donnees.getAll("seance").map(String).filter((s) => uuid.safeParse(s).success).slice(0, 8);
  const format = String(donnees.get("format") ?? "");
  const objectif = String(donnees.get("objectif") ?? "essentiel");
  const longueur = String(donnees.get("longueur") ?? "courte");
  const titre = String(donnees.get("titre") ?? "").trim();
  const cle = String(donnees.get("cle") ?? "");
  const valeurs = { format, objectif, longueur, titre, seances: lecons.join(",") };
  const champs: Record<string, string[]> = {};
  if (lecons.length === 0) champs.seance = ["Choisis au moins une séance."];
  if (!["essentiel", "detaille", "cartes", "quiz", "controle"].includes(format)) champs.format = ["Choisis un format."];
  if (titre.length < 2) champs.titre = ["Donne un titre à ta fiche."];
  if (Object.keys(champs).length > 0) return { ok: false, message: "Il manque quelque chose.", champs, valeurs };

  const requestId = idRequete();
  const { jeton } = await contexteApp();
  const { data, error } = await clientUtilisateur(jeton).rpc("fiche_creer", {
    p_titre: titre.slice(0, 140),
    p_format: format,
    p_objectif: objectif === "comprendre" ? "comprendre" : "essentiel",
    p_longueur: longueur === "detaillee" ? "detaillee" : "courte",
    p_lecons: lecons,
    p_cle: uuid.safeParse(cle).success ? cle : randomUUID(),
  });
  if (error !== null) {
    const e = traduire(error, requestId);
    return { ok: false, message: e.message, requestId, valeurs };
  }
  const ligne = ((data ?? []) as { id: string }[])[0];
  if (!ligne) return { ok: false, message: "La fiche n'a pas pu être créée.", requestId, valeurs };
  reveiller();
  redirect(`/app/fiches/${ligne.id}`);
}

export async function annulerFiche(donnees: FormData): Promise<void> {
  const fiche = uuid.safeParse(String(donnees.get("fiche") ?? ""));
  if (!fiche.success) return;
  const { jeton } = await contexteApp();
  await clientUtilisateur(jeton).rpc("fiche_annuler", { p_fiche: fiche.data });
  revalidatePath(`/app/fiches/${fiche.data}`);
}

export async function modifierFiche(fiche: string, version: number, _p: EtatFormulaire, donnees: FormData): Promise<EtatFormulaire> {
  const requestId = idRequete();
  const textes = donnees.getAll("extrait").map(String);
  const titres = donnees.getAll("section").map(String);
  // Reconstruit les sections en gardant les citations d'origine, dans l'ordre.
  const { jeton } = await contexteApp();
  const actuelle = await clientUtilisateur(jeton).rpc("fiche_lire", { p_fiche: fiche });
  const f = ((actuelle.data ?? []) as { sections: { titre: string; role: string; extraits: { texte: string; citation: unknown }[] }[] | null }[])[0];
  if (!f?.sections) return { ok: false, message: "Cette fiche ne peut pas être modifiée.", requestId };
  let i = 0;
  const sections = f.sections.map((s, k) => ({
    ...s,
    titre: (titres[k] ?? s.titre).slice(0, 200),
    extraits: s.extraits.map((e) => ({ ...e, texte: (textes[i++] ?? e.texte).slice(0, 4000) })).filter((e) => e.texte.trim().length > 0),
  }));
  const { data, error } = await clientUtilisateur(jeton).rpc("fiche_modifier", { p_fiche: fiche, p_sections: sections, p_cartes: null, p_version: version });
  if (error !== null) {
    const e = traduire(error, requestId);
    return { ok: false, message: e.message, requestId, code: e.code };
  }
  revalidatePath(`/app/fiches/${fiche}`);
  return { ok: true, message: `Version ${String(data)} enregistrée. L'ancienne est conservée.` };
}

export type Resultat = { ok: true; donnees?: unknown } | { ok: false; code: CodeErreur; message: string; requestId: string };

async function rpc(fn: string, p: Record<string, unknown>): Promise<Resultat> {
  const requestId = idRequete();
  const { jeton } = await contexteApp();
  const { data, error } = await clientUtilisateur(jeton).rpc(fn, p);
  if (error !== null) {
    const e = traduire(error, requestId);
    return { ok: false, code: e.code, message: e.message, requestId };
  }
  return { ok: true, donnees: data };
}

export async function avisCarte(fiche: string, carte: number, avis: "a_revoir" | "je_savais", client: string): Promise<Resultat> {
  return rpc("carte_avis", { p_fiche: fiche, p_carte: carte, p_avis: avis, p_client: client });
}

export async function tenter(version: string, reponse: Record<string, unknown>, client: string, session: string | null, tempsS: number): Promise<Resultat> {
  if (!uuid.safeParse(version).success || !uuid.safeParse(client).success) {
    return { ok: false, code: "VALIDATION_FAILED", message: "Réponse invalide.", requestId: idRequete() };
  }
  const r = await rpc("revision_tenter", {
    p_version: version,
    p_reponse: reponse,
    p_client_id: client,
    p_session: session,
    p_temps_s: Math.max(0, Math.min(1800, Math.round(tempsS))),
  });
  if (!r.ok) return r;
  return { ok: true, donnees: ((r.donnees ?? []) as unknown[])[0] ?? null };
}

export async function demanderAide(version: string, niveau: "indice" | "exemple"): Promise<Resultat> {
  return rpc("revision_aide", { p_version: version, p_niveau: niveau });
}

export async function variante(version: string): Promise<Resultat> {
  return rpc("revision_variante", { p_version: version });
}

/** Ouvrir un entraînement depuis une fiche-quiz, une variante, ou un résultat de recherche. */
export async function lancerEntrainement(donnees: FormData): Promise<void> {
  const versions = donnees.getAll("version").map(String).filter((v) => uuid.safeParse(v).success).slice(0, 40);
  const fiche = uuid.safeParse(String(donnees.get("fiche") ?? ""));
  const titre = String(donnees.get("titre") ?? "Entraînement").slice(0, 140);
  if (versions.length === 0) redirect("/app/reviser?erreur=aucun-exercice");
  const r = await rpc("entrainement_ouvrir", { p_titre: titre, p_versions: versions, p_fiche: fiche.success ? fiche.data : null });
  if (!r.ok) redirect(`/app/reviser?erreur=${r.code}`);
  redirect(`/app/entrainements/${String(r.donnees)}`);
}

export async function annoterErreur(entree: string, revision: number, _p: EtatFormulaire, donnees: FormData): Promise<EtatFormulaire> {
  const categorie = String(donnees.get("categorie") ?? "");
  const note = String(donnees.get("note") ?? "").slice(0, 2000);
  const r = await rpc("carnet_annoter", {
    p_entree: entree,
    p_categorie: ["calcul", "methode", "lecture", "cours", "inattention", "autre"].includes(categorie) ? categorie : null,
    p_note: note,
    p_revision: revision,
  });
  if (!r.ok) return { ok: false, message: r.message, requestId: r.requestId, valeurs: { categorie, note } };
  revalidatePath("/app/erreurs");
  return { ok: true, message: "Enregistré.", valeurs: { categorie, note, revision: String(r.donnees) } };
}

export async function archiverErreur(donnees: FormData): Promise<void> {
  const entree = uuid.safeParse(String(donnees.get("entree") ?? ""));
  if (!entree.success) return;
  const { jeton } = await contexteApp();
  await clientUtilisateur(jeton)
    .from("carnet_erreurs")
    .update({ archived_at: donnees.get("restaurer") === "oui" ? null : new Date().toISOString() })
    .eq("id", entree.data);
  revalidatePath("/app/erreurs");
}
