import "server-only";

import { randomUUID } from "node:crypto";
import { createHash } from "node:crypto";
import {
  REGLAGES_PAR_DEFAUT,
  relireDocument,
  relireReglages,
  type DocumentCours,
  type ReglagesPresentation,
} from "./document-cours.ts";
import { extraire, ImportRefuse, TAILLE_MAXIMALE_IMPORT } from "./extraction.ts";
import { clientExploitation, clientUtilisateur } from "./supabase-serveur.ts";

/**
 * Documents du Studio — cahier « Refonte fidèle », S02 à S17.
 *
 * Toutes les lectures et les écritures ordinaires passent par le **jeton du
 * professeur** : c'est la politique `studio_documents_owner` qui décide, et
 * elle est stricte — un document en préparation n'appartient qu'à son auteur.
 *
 * La clé de service n'apparaît que pour deux gestes qui ne peuvent pas passer
 * autrement : déposer les octets dans un bucket privé, et appeler la fonction
 * de publication, qui doit écrire dans `lessons` au nom du professeur après
 * avoir revérifié son affectation en base.
 */

export const BUCKET_IMPORTS = "course-materials";

export type EtatDocument = "importe" | "traitement" | "a_verifier" | "pret" | "echec";

export interface DocumentStudio {
  readonly id: string;
  readonly titre: string;
  readonly etat: EtatDocument;
  readonly erreur: string | null;
  readonly revisionId: string | null;
  readonly majLe: string;
}

interface LigneDocument {
  id: string;
  title: string;
  state: EtatDocument;
  erreur: string | null;
  current_revision_id: string | null;
  updated_at: string;
}

function enDocument(ligne: LigneDocument): DocumentStudio {
  return {
    id: ligne.id,
    titre: ligne.title,
    etat: ligne.state,
    erreur: ligne.erreur,
    revisionId: ligne.current_revision_id,
    majLe: ligne.updated_at,
  };
}

/** Les derniers cours du professeur, le plus récemment touché en tête (S02). */
export async function mesDocuments(jeton: string, limite = 40): Promise<DocumentStudio[]> {
  const { data, error } = await clientUtilisateur(jeton)
    .from("studio_documents")
    .select("id, title, state, erreur, current_revision_id, updated_at")
    .is("archived_at", null)
    .order("updated_at", { ascending: false })
    .limit(limite);

  if (error !== null) return [];
  return ((data ?? []) as unknown as LigneDocument[]).map(enDocument);
}

export async function document(jeton: string, id: string): Promise<DocumentStudio | null> {
  const { data, error } = await clientUtilisateur(jeton)
    .from("studio_documents")
    .select("id, title, state, erreur, current_revision_id, updated_at")
    .eq("id", id)
    .maybeSingle();

  if (error !== null || data === null) return null;
  return enDocument(data as unknown as LigneDocument);
}

export interface Revision {
  readonly id: string;
  readonly numero: number;
  readonly document: DocumentCours;
  readonly reglages: ReglagesPresentation;
}

/** Relit la révision courante d'un document. */
export async function revision(jeton: string, revisionId: string): Promise<Revision | null> {
  const { data, error } = await clientUtilisateur(jeton)
    .from("content_versions")
    .select("id, body, version_number")
    .eq("id", revisionId)
    .maybeSingle();

  if (error !== null || data === null) return null;

  const ligne = data as unknown as { id: string; body: unknown; version_number: number };
  const corps = (typeof ligne.body === "object" && ligne.body !== null ? ligne.body : {}) as
    Record<string, unknown>;

  const contenu = relireDocument(corps.document);
  if (contenu === null) return null;

  return {
    id: ligne.id,
    numero: ligne.version_number,
    document: contenu,
    reglages: relireReglages(corps.reglages),
  };
}

/* -------------------------------------------------------------------------- */
/* Import                                                                     */
/* -------------------------------------------------------------------------- */

export type ResultatImport =
  | { readonly etat: "ok"; readonly document: string }
  | { readonly etat: "refus"; readonly message: string };

/**
 * Dépose un document et lance son traitement.
 *
 * Le fichier suit le cycle du chapitre 38 — réservation, transfert,
 * finalisation — exactement comme un support de séance : c'est la même table,
 * les mêmes politiques, le même garde-fou d'état.
 *
 * L'extraction, elle, n'a **pas** lieu ici. Une action serveur Vercel a une
 * durée et une taille de requête bornées (T03) : y faire tenir la conversion
 * d'un PDF de cinquante pages fonctionne sur un fichier d'essai et échoue le
 * jour de la rentrée. Le traitement part donc dans la file durable, et l'écran
 * suit son avancement.
 */
export async function importer(options: {
  jeton: string;
  organisation: string;
  proprietaire: string;
  fichier: File;
}): Promise<ResultatImport> {
  if (options.fichier.size === 0) {
    return { etat: "refus", message: "Ce fichier est vide." };
  }
  if (options.fichier.size > TAILLE_MAXIMALE_IMPORT) {
    return {
      etat: "refus",
      message: `Ce fichier dépasse ${Math.round(TAILLE_MAXIMALE_IMPORT / (1024 * 1024))} Mo.`,
    };
  }

  const octets = Buffer.from(await options.fichier.arrayBuffer());
  const client = clientUtilisateur(options.jeton);
  const titre = titreDepuisNom(options.fichier.name);

  // 1. Le document, d'abord : il donne l'identifiant qui sert de chemin.
  const { data: cree, error: erreurDocument } = await client
    .from("studio_documents")
    .insert({
      organization_id: options.organisation,
      owner_id: options.proprietaire,
      title: titre,
      state: "importe",
    })
    .select("id")
    .single();

  if (erreurDocument !== null || cree === null) {
    return { etat: "refus", message: "Le document n'a pas pu être enregistré." };
  }

  const documentId = (cree as { id: string }).id;
  const cle = `${options.organisation}/${documentId}/${randomUUID()}`;

  // 2. Réservation du fichier.
  const { data: fichierCree, error: erreurFichier } = await client
    .from("files")
    .insert({
      organization_id: options.organisation,
      owner_id: options.proprietaire,
      display_name: options.fichier.name.slice(0, 120),
      storage_key: cle,
      bucket: BUCKET_IMPORTS,
      mime_declared: options.fichier.type === "" ? null : options.fichier.type,
      byte_size: 0,
      taille_annoncee: octets.length,
      state: "reserve",
      reserved_by: options.proprietaire,
      reserved_at: new Date().toISOString(),
      attached_kind: "support_seance",
      attached_id: documentId,
    })
    .select("id")
    .single();

  if (erreurFichier !== null || fichierCree === null) {
    await client.from("studio_documents").delete().eq("id", documentId);
    return { etat: "refus", message: "Le document n'a pas pu être enregistré." };
  }

  const fileId = (fichierCree as { id: string }).id;
  const service = clientExploitation("stockage_des_supports");

  // 3. Transfert.
  const { error: erreurDepot } = await service.storage
    .from(BUCKET_IMPORTS)
    .upload(cle, octets, { contentType: "application/octet-stream", upsert: false });

  if (erreurDepot !== null) {
    await client.from("studio_documents").delete().eq("id", documentId);
    return { etat: "refus", message: "Le dépôt a échoué. Réessayez dans un instant." };
  }

  // 4. Finalisation.
  await service.rpc("finaliser_support_de_seance", {
    p_fichier: fileId,
    p_mime_detecte: "application/octet-stream",
    p_taille: octets.length,
    p_sha256: `\\x${createHash("sha256").update(octets).digest("hex")}`,
  });

  await client
    .from("studio_documents")
    .update({ source_file_id: fileId, state: "traitement", updated_at: new Date().toISOString() })
    .eq("id", documentId);

  // 5. Le travail part dans la file. La clé d'idempotence est l'empreinte du
  //    document : redéposer deux fois le même fichier ne relance pas deux
  //    conversions identiques (T08, O02).
  await service.rpc("programmer_import_cours", {
    p_organisation: options.organisation,
    p_document: documentId,
    p_fichier: fileId,
  });

  return { etat: "ok", document: documentId };
}

function titreDepuisNom(nom: string): string {
  const base = nom
    .replace(/\.[^.]*$/, "")
    .replace(/[_-]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 120);
  return base === "" ? "Document sans titre" : base;
}

/* -------------------------------------------------------------------------- */
/* Traitement (appelé par le worker)                                          */
/* -------------------------------------------------------------------------- */

/**
 * Convertit un document déjà déposé et enregistre sa première révision.
 *
 * Idempotent : relancé sur un document déjà converti, il écrit une nouvelle
 * révision plutôt que d'échouer — c'est ce que fait « Réessayer » (S05).
 */
export async function convertir(options: {
  organisation: string;
  document: string;
  fichier: string;
  proprietaire: string;
}): Promise<{ ok: true } | { ok: false; message: string }> {
  const service = clientExploitation("stockage_des_supports");

  const { data: ligne } = await service
    .from("files")
    .select("storage_key")
    .eq("id", options.fichier)
    .maybeSingle();

  const cle = (ligne as { storage_key: string } | null)?.storage_key ?? null;
  if (cle === null) return { ok: false, message: "Le fichier d'origine est introuvable." };

  const { data: objet, error: erreurLecture } = await service.storage
    .from(BUCKET_IMPORTS)
    .download(cle);

  if (erreurLecture !== null || objet === null) {
    return { ok: false, message: "Le fichier d'origine n'a pas pu être relu." };
  }

  let contenu: DocumentCours;
  try {
    contenu = await extraire(Buffer.from(await objet.arrayBuffer()));
  } catch (erreur) {
    const message =
      erreur instanceof ImportRefuse
        ? erreur.message
        : "Ce document n'a pas pu être converti.";
    await service
      .from("studio_documents")
      .update({ state: "echec", erreur: message, updated_at: new Date().toISOString() })
      .eq("id", options.document);
    return { ok: false, message };
  }

  const { data: precedentes } = await service
    .from("content_versions")
    .select("version_number")
    .eq("organization_id", options.organisation)
    .order("version_number", { ascending: false })
    .limit(1);

  const numero =
    ((precedentes ?? []) as { version_number: number }[])[0]?.version_number ?? 0;

  const { data: creee, error: erreurVersion } = await service
    .from("content_versions")
    .insert({
      organization_id: options.organisation,
      body: { document: contenu, reglages: REGLAGES_PAR_DEFAUT },
      version_number: numero + 1,
      created_by: options.proprietaire,
    })
    .select("id")
    .single();

  if (erreurVersion !== null || creee === null) {
    return { ok: false, message: "La révision n'a pas pu être enregistrée." };
  }

  await service
    .from("studio_documents")
    .update({
      state: "a_verifier",
      erreur: null,
      current_revision_id: (creee as { id: string }).id,
      title: contenu.titre.slice(0, 120),
      updated_at: new Date().toISOString(),
    })
    .eq("id", options.document);

  return { ok: true };
}

/* -------------------------------------------------------------------------- */
/* Suivi                                                                      */
/* -------------------------------------------------------------------------- */

export interface EtatTraitement {
  readonly state: string;
  readonly attempts: number;
  readonly erreur: string | null;
}

export async function etatTraitement(
  acteur: string,
  documentId: string,
): Promise<EtatTraitement | null> {
  const { data, error } = await clientExploitation("administration_des_comptes").rpc(
    "studio_etat_traitement",
    { p_acteur: acteur, p_document: documentId },
  );

  if (error !== null) return null;
  const ligne = Array.isArray(data) ? data[0] : null;
  if (ligne == null) return null;

  return { state: ligne.state, attempts: ligne.attempts, erreur: ligne.last_error ?? null };
}
