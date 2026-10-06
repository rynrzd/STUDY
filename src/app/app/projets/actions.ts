"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import type { EtatFormulaire } from "@/components/study/formulaire";
import { clientUtilisateur } from "@/lib/supabase-serveur";
import { contexteApp, idRequete } from "@/lib/v6/contexte";
import { traduire } from "@/lib/v6/erreurs";

/** Projets — E14, E15. Toutes les vérifications de rôle sont en base. */

const uuid = z.string().uuid();

async function rpc(fn: string, p: Record<string, unknown>) {
  const requestId = idRequete();
  const { jeton } = await contexteApp();
  const { data, error } = await clientUtilisateur(jeton).rpc(fn, p);
  return { data, erreur: error === null ? null : traduire(error, requestId) };
}

export async function creerProjet(_p: EtatFormulaire, donnees: FormData): Promise<EtatFormulaire> {
  const valeurs = {
    titre: String(donnees.get("titre") ?? "").trim(),
    description: String(donnees.get("description") ?? "").trim(),
    visibilite: donnees.get("visibilite") === "groupe" ? "groupe" : "prive",
    classe: String(donnees.get("classe") ?? ""),
  };
  if (valeurs.titre.length < 2) return { ok: false, message: "Donne un nom au projet.", champs: { titre: ["Deux caractères au moins."] }, valeurs };
  if (valeurs.visibilite === "groupe" && !uuid.safeParse(valeurs.classe).success) {
    return { ok: false, message: "Choisis la classe du projet.", champs: { classe: ["Un projet de groupe appartient à une classe."] }, valeurs };
  }
  const { data, erreur } = await rpc("projet_creer", {
    p_titre: valeurs.titre.slice(0, 120),
    p_description: valeurs.description.slice(0, 4000),
    p_visibilite: valeurs.visibilite,
    p_classe: valeurs.visibilite === "groupe" ? valeurs.classe : null,
  });
  if (erreur) return { ok: false, message: erreur.message, requestId: erreur.requestId, valeurs };
  redirect(`/app/projets/${String(data)}`);
}

export async function inviter(projet: string, _p: EtatFormulaire, donnees: FormData): Promise<EtatFormulaire> {
  const profil = String(donnees.get("profil") ?? "");
  const role = donnees.get("role") === "viewer" ? "viewer" : "editor";
  if (!uuid.safeParse(profil).success) return { ok: false, message: "Choisis une personne.", champs: { profil: ["Requis."] } };
  const { erreur } = await rpc("projet_inviter", { p_projet: projet, p_profile: profil, p_role: role });
  if (erreur) return { ok: false, message: erreur.message, requestId: erreur.requestId };
  revalidatePath(`/app/projets/${projet}`);
  return { ok: true, message: "Invitation envoyée. La personne doit l'accepter." };
}

export async function repondreInvitation(donnees: FormData): Promise<void> {
  const projet = uuid.safeParse(String(donnees.get("projet") ?? ""));
  if (!projet.success) return;
  await rpc("projet_repondre", { p_projet: projet.data, p_accepter: donnees.get("accepter") === "oui" });
  revalidatePath("/app/projets");
  if (donnees.get("accepter") === "oui") redirect(`/app/projets/${projet.data}`);
  redirect("/app/projets");
}

export async function retirerMembre(donnees: FormData): Promise<void> {
  const projet = uuid.safeParse(String(donnees.get("projet") ?? ""));
  const profil = uuid.safeParse(String(donnees.get("profil") ?? ""));
  if (!projet.success || !profil.success) return;
  await rpc("projet_retirer", { p_projet: projet.data, p_profile: profil.data });
  revalidatePath(`/app/projets/${projet.data}`);
}

export async function archiverProjet(donnees: FormData): Promise<void> {
  const projet = uuid.safeParse(String(donnees.get("projet") ?? ""));
  if (!projet.success) return;
  await rpc("projet_archiver", { p_projet: projet.data });
  redirect("/app/projets");
}

export async function ajouterTache(projet: string, _p: EtatFormulaire, donnees: FormData): Promise<EtatFormulaire> {
  const titre = String(donnees.get("titre") ?? "").trim();
  const responsable = String(donnees.get("responsable") ?? "");
  const echeance = String(donnees.get("echeance") ?? "");
  if (titre.length < 2) return { ok: false, message: "Décris la tâche.", champs: { titre: ["Deux caractères au moins."] }, valeurs: { titre, responsable, echeance } };
  const { erreur } = await rpc("projet_tache_creer", {
    p_projet: projet,
    p_titre: titre.slice(0, 200),
    p_responsable: uuid.safeParse(responsable).success ? responsable : null,
    p_echeance: /^\d{4}-\d{2}-\d{2}$/u.test(echeance) ? echeance : null,
  });
  if (erreur) return { ok: false, message: erreur.message, requestId: erreur.requestId, valeurs: { titre, responsable, echeance } };
  revalidatePath(`/app/projets/${projet}`);
  return { ok: true, message: "Tâche ajoutée." };
}

/** Déplacer, (ré)assigner : sous version attendue ; un conflit renvoie l'état explicite. */
export async function modifierTache(donnees: FormData): Promise<void> {
  const tache = uuid.safeParse(String(donnees.get("tache") ?? ""));
  const projet = uuid.safeParse(String(donnees.get("projet") ?? ""));
  if (!tache.success || !projet.success) return;
  const statut = String(donnees.get("statut") ?? "");
  const responsable = String(donnees.get("responsable") ?? "");
  const { erreur } = await rpc("projet_tache_modifier", {
    p_tache: tache.data,
    p_version: Number(donnees.get("version") ?? 0),
    p_statut: ["a_faire", "en_cours", "termine"].includes(statut) ? statut : null,
    p_titre: null,
    p_responsable: uuid.safeParse(responsable).success ? responsable : null,
    p_echeance: null,
    p_effacer_responsable: donnees.get("effacer") === "oui",
  });
  revalidatePath(`/app/projets/${projet.data}`);
  if (erreur) redirect(`/app/projets/${projet.data}?conflit=${erreur.code === "VERSION_CONFLICT" ? "1" : "0"}`);
}

export async function supprimerTache(donnees: FormData): Promise<void> {
  const tache = uuid.safeParse(String(donnees.get("tache") ?? ""));
  const projet = uuid.safeParse(String(donnees.get("projet") ?? ""));
  if (!tache.success || !projet.success) return;
  const { erreur } = await rpc("projet_tache_supprimer", { p_tache: tache.data, p_version: Number(donnees.get("version") ?? 0) });
  revalidatePath(`/app/projets/${projet.data}`);
  if (erreur) redirect(`/app/projets/${projet.data}?conflit=1`);
}

export async function ajouterNote(projet: string, _p: EtatFormulaire, donnees: FormData): Promise<EtatFormulaire> {
  const valeurs = {
    kind: ["document", "decision", "lien"].includes(String(donnees.get("kind"))) ? String(donnees.get("kind")) : "document",
    titre: String(donnees.get("titre") ?? "").trim(),
    corps: String(donnees.get("corps") ?? "").trim(),
    url: String(donnees.get("url") ?? "").trim(),
  };
  if (valeurs.titre.length < 2) return { ok: false, message: "Donne un titre.", champs: { titre: ["Deux caractères au moins."] }, valeurs };
  if (valeurs.url && !/^https?:\/\//u.test(valeurs.url)) return { ok: false, message: "Le lien doit commencer par http:// ou https://.", champs: { url: ["Adresse invalide."] }, valeurs };
  const { erreur } = await rpc("projet_note_ajouter", {
    p_projet: projet,
    p_kind: valeurs.kind,
    p_titre: valeurs.titre.slice(0, 160),
    p_corps: valeurs.corps.slice(0, 12000),
    p_url: valeurs.url || null,
  });
  if (erreur) return { ok: false, message: erreur.message, requestId: erreur.requestId, valeurs };
  revalidatePath(`/app/projets/${projet}`);
  return { ok: true, message: "Ajouté au projet." };
}
