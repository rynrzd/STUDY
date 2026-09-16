"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { relireDocument, relireReglages } from "@/lib/document-cours";
import { importer } from "@/lib/studio-documents";
import { jetonAccesDe, sessionCourante } from "@/lib/session-serveur";
import { clientExploitation, clientUtilisateur } from "@/lib/supabase-serveur";

/**
 * Actions du Studio — cahier « Refonte fidèle », S02, S12, S14.
 *
 * Chaque action relit la session et agit avec le jeton du professeur : c'est la
 * politique `studio_documents_owner` qui décide, pas une vérification écrite
 * ici. Un identifiant changé dans l'adresse ne donne rien — pas un refus, rien.
 */

import type {
  EtatImportStudio,
  EtatPublication,
  EtatSauvegarde,
} from "./etats";

const REFUS_IMPORT: EtatImportStudio = {
  etat: "erreur",
  message: "Ce document n'a pas pu être importé.",
};

async function professeur(): Promise<
  { jeton: string; profileId: string; organisation: string } | null
> {
  const personne = await sessionCourante();
  if (personne === null || personne.activationRequise) return null;
  if (!personne.roles.includes("professeur")) return null;
  if (personne.organizationId === null) return null;

  const jeton = await jetonAccesDe(personne);
  return jeton === null
    ? null
    : { jeton, profileId: personne.profileId, organisation: personne.organizationId };
}

/* ------------------------------------------------------------- Import ---- */

export async function importerDocument(
  _precedent: EtatImportStudio,
  donnees: FormData,
): Promise<EtatImportStudio> {
  const session = await professeur();
  if (session === null) return REFUS_IMPORT;

  const fichier = donnees.get("fichier");
  if (!(fichier instanceof File) || fichier.size === 0) {
    return { etat: "erreur", message: "Choisissez un document à importer." };
  }

  const resultat = await importer({
    jeton: session.jeton,
    organisation: session.organisation,
    proprietaire: session.profileId,
    fichier,
  });

  if (resultat.etat === "refus") {
    return { etat: "erreur", message: resultat.message };
  }

  revalidatePath("/professeur/studio");
  return { etat: "envoi", document: resultat.document };
}

/* -------------------------------------------------------- Sauvegarde ---- */

/**
 * Enregistre une révision.
 *
 * Une révision n'écrase jamais la précédente : elle s'ajoute. C'est ce qui
 * permet à une classe de garder la version qu'elle a reçue pendant que le
 * professeur remanie la suivante (S14).
 *
 * `revisionAttendue` est le numéro que l'éditeur croit courant. S'il ne
 * correspond plus, un autre onglet a enregistré entre-temps : on refuse, et
 * l'écran le dit. Écraser silencieusement le travail d'un second onglet est le
 * genre de perte qu'on ne découvre que trop tard (S12).
 */
export async function enregistrerRevision(
  _precedent: EtatSauvegarde,
  donnees: FormData,
): Promise<EtatSauvegarde> {
  const session = await professeur();
  if (session === null) return { etat: "erreur", message: "Session expirée." };

  const analyse = z
    .object({ document: z.string().uuid(), attendue: z.coerce.number().int().nonnegative() })
    .safeParse({ document: donnees.get("document"), attendue: donnees.get("attendue") });

  if (!analyse.success) return { etat: "erreur", message: "Enregistrement refusé." };

  let brouillon: unknown;
  try {
    brouillon = JSON.parse(String(donnees.get("brouillon") ?? "{}"));
  } catch {
    return { etat: "erreur", message: "Enregistrement refusé." };
  }

  const corps = (brouillon ?? {}) as Record<string, unknown>;
  const contenu = relireDocument(corps.document);
  if (contenu === null) return { etat: "erreur", message: "Enregistrement refusé." };
  const reglages = relireReglages(corps.reglages);

  const client = clientUtilisateur(session.jeton);

  const { data: ligne } = await client
    .from("studio_documents")
    .select("id, organization_id, current_revision_id")
    .eq("id", analyse.data.document)
    .maybeSingle();

  const doc = ligne as
    | { id: string; organization_id: string; current_revision_id: string | null }
    | null;
  if (doc === null) return { etat: "erreur", message: "Document introuvable." };

  let numeroCourant = 0;
  if (doc.current_revision_id !== null) {
    const { data: courante } = await client
      .from("content_versions")
      .select("version_number")
      .eq("id", doc.current_revision_id)
      .maybeSingle();
    numeroCourant = (courante as { version_number: number } | null)?.version_number ?? 0;
  }

  if (analyse.data.attendue !== numeroCourant) {
    return {
      etat: "conflit",
      revision: numeroCourant,
      message:
        "Ce cours a été enregistré ailleurs entre-temps — un autre onglet, sans doute. " +
        "Rechargez la page pour repartir de la dernière version.",
    };
  }

  const { data: creee, error } = await client
    .from("content_versions")
    .insert({
      organization_id: doc.organization_id,
      body: { document: contenu, reglages },
      version_number: numeroCourant + 1,
      created_by: session.profileId,
    })
    .select("id, version_number")
    .single();

  if (error !== null || creee === null) {
    return { etat: "erreur", message: "L'enregistrement a échoué. Réessayez." };
  }

  const nouvelle = creee as { id: string; version_number: number };

  await client
    .from("studio_documents")
    .update({
      current_revision_id: nouvelle.id,
      title: contenu.titre.slice(0, 120),
      updated_at: new Date().toISOString(),
    })
    .eq("id", doc.id);

  revalidatePath(`/professeur/studio/${doc.id}`);
  return { etat: "enregistre", revision: nouvelle.version_number };
}

/* ------------------------------------------------------------ Revue ----- */

/** Marque le document relu par le professeur (S11). */
export async function confirmerRevue(
  _precedent: EtatSauvegarde,
  donnees: FormData,
): Promise<EtatSauvegarde> {
  const session = await professeur();
  if (session === null) return { etat: "erreur", message: "Session expirée." };

  const id = String(donnees.get("document") ?? "");
  if (!z.string().uuid().safeParse(id).success) {
    return { etat: "erreur", message: "Action refusée." };
  }

  const { error } = await clientUtilisateur(session.jeton)
    .from("studio_documents")
    .update({ state: "pret", updated_at: new Date().toISOString() })
    .eq("id", id);

  if (error !== null) return { etat: "erreur", message: "Action refusée." };

  revalidatePath(`/professeur/studio/${id}`);
  return { etat: "enregistre", message: "Contenu vérifié par vos soins." };
}

/* ------------------------------------------------------ Publication ----- */

export async function publierDocument(
  _precedent: EtatPublication,
  donnees: FormData,
): Promise<EtatPublication> {
  const session = await professeur();
  if (session === null) return { etat: "erreur", message: "Session expirée." };

  const analyse = z
    .object({
      document: z.string().uuid(),
      cours: z.string().uuid(),
      titre: z.string().trim().min(1).max(160),
      revue: z.literal("oui"),
    })
    .safeParse({
      document: donnees.get("document"),
      cours: donnees.get("cours"),
      titre: donnees.get("titre"),
      revue: donnees.get("revue"),
    });

  if (!analyse.success) {
    return {
      etat: "erreur",
      message:
        "Choisissez une classe et confirmez avoir relu le cours avant de le publier.",
    };
  }

  // La publication écrit dans `lessons` : elle passe par la fonction dédiée,
  // qui revérifie l'affectation en base au moment du clic. Entre l'affichage de
  // l'écran et maintenant, une affectation a pu être retirée.
  const { error } = await clientExploitation("administration_des_comptes").rpc("studio_publier", {
    p_acteur: session.profileId,
    p_document: analyse.data.document,
    p_cours: analyse.data.cours,
    p_titre: analyse.data.titre,
  });

  if (error !== null) {
    return {
      etat: "erreur",
      message:
        "La publication a été refusée. Vérifiez que vous enseignez toujours dans cette classe.",
    };
  }

  revalidatePath(`/professeur/studio/${analyse.data.document}`);
  revalidatePath("/eleve");
  revalidatePath("/eleve/cours");

  return { etat: "ok", message: "Le cours est publié : la classe y a accès." };
}
