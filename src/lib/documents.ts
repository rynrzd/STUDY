import "server-only";

import { createHash, randomUUID } from "node:crypto";
import {
  FORMATS_ACCEPTES,
  nomLisible,
  reconnaitre,
  TAILLE_MAXIMALE_SUPPORT,
  type TypeReconnu,
} from "./formats-documents.ts";
import { clientExploitation, clientUtilisateur } from "./supabase-serveur.ts";

/**
 * Documents joints aux séances — cahier V2, §12.
 *
 * Trois règles tiennent tout le reste :
 *
 * 1. **Le type est vérifié sur les octets, pas sur le nom.** Un fichier appelé
 *    « cours.pdf » qui commence par `<script>` est un fichier HTML. L'extension
 *    et l'en-tête `Content-Type` viennent du navigateur : ils sont indicatifs.
 *    La signature, elle, est dans le fichier.
 *
 * 2. **Le chemin de stockage est fabriqué ici.** Jamais le nom d'origine : il
 *    contiendrait des accents, des espaces, parfois un nom d'élève, et surtout
 *    il permettrait de deviner l'adresse d'un autre fichier.
 *
 * 3. **Rien n'est servi en ligne.** Le téléchargement passe par notre route,
 *    avec `Content-Disposition: attachment` : un PDF piégé s'ouvre dans le
 *    lecteur de la personne, pas dans l'origine de l'application.
 *
 * Ce qui n'est PAS fait, et qu'il faut savoir : aucun moteur antivirus n'est
 * raccordé. Le fichier est déposé par un enseignant identifié de
 * l'établissement et rendu à ses propres élèves ; c'est le modèle de confiance
 * retenu, et `scan_result` le consigne noir sur blanc plutôt que de laisser
 * croire à une analyse qui n'a pas eu lieu.
 */

export const BUCKET_SUPPORTS = "course-materials";

export type { TypeReconnu };

export interface SupportDepose {
  readonly fileId: string;
  readonly nom: string;
  readonly taille: number;
  readonly type: TypeReconnu;
}

export type ResultatDepot =
  | { readonly etat: "ok"; readonly support: SupportDepose }
  | { readonly etat: "refus"; readonly message: string };

/**
 * Dépose un support de séance.
 *
 * L'ordre est important : les octets partent au stockage d'abord, la ligne en
 * base ensuite. Si la base refuse, l'objet déposé est retiré — sans quoi le
 * stockage se remplirait de fichiers que plus rien ne référence, et qu'aucun
 * écran ne permettrait de supprimer.
 */
export async function deposerSupport(options: {
  jeton: string;
  organisation: string;
  seance: string;
  proprietaire: string;
  fichier: File;
}): Promise<ResultatDepot> {
  if (options.fichier.size === 0) {
    return { etat: "refus", message: "Ce fichier est vide." };
  }

  if (options.fichier.size > TAILLE_MAXIMALE_SUPPORT) {
    return {
      etat: "refus",
      message: `Ce fichier dépasse ${Math.round(TAILLE_MAXIMALE_SUPPORT / (1024 * 1024))} Mo.`,
    };
  }

  const octets = Buffer.from(await options.fichier.arrayBuffer());
  const type = reconnaitre(octets, options.fichier.type === "" ? null : options.fichier.type);

  if (type === null) {
    return {
      etat: "refus",
      message: `Ce format n'est pas accepté. Formats possibles : ${FORMATS_ACCEPTES}.`,
    };
  }

  const nom = nomLisible(options.fichier.name, type.extension);
  const empreinte = createHash("sha256").update(octets).digest("hex");

  // Le chemin est impose par le chapitre 38 : trois identifiants, rien d'autre.
  // Pas d'extension : le type servi vient de `mime_detected`, jamais du nom.
  const cle = `${options.organisation}/${options.seance}/${randomUUID()}`;

  // Phase 1 — la reservation. La ligne nait en « reserve », ce que la politique
  // `files_owner_insert` est la seule a autoriser depuis une session
  // navigateur : personne ne peut declarer un fichier servable en l'inserant.
  const { data, error } = await clientUtilisateur(options.jeton)
    .from("files")
    .insert({
      organization_id: options.organisation,
      owner_id: options.proprietaire,
      display_name: nom,
      storage_key: cle,
      bucket: BUCKET_SUPPORTS,
      mime_declared: options.fichier.type === "" ? null : options.fichier.type,
      byte_size: 0,
      taille_annoncee: octets.length,
      state: "reserve",
      reserved_by: options.proprietaire,
      reserved_at: new Date().toISOString(),
      reservation_expire_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      attached_kind: "support_seance",
      attached_id: options.seance,
    })
    .select("id")
    .single();

  if (error !== null || data === null) {
    console.error(
      JSON.stringify({ niveau: "erreur", contexte: "documents.reservation", code: error?.code }),
    );
    return { etat: "refus", message: "Le document n'a pas pu être enregistré." };
  }

  const fileId = (data as { id: string }).id;
  const stockage = clientExploitation("stockage_des_supports").storage.from(BUCKET_SUPPORTS);

  // Phase 2 — le transfert.
  const { error: erreurDepot } = await stockage.upload(cle, octets, {
    contentType: type.mime,
    upsert: false,
  });

  if (erreurDepot !== null) {
    await abandonner(options.jeton, fileId);
    console.error(
      JSON.stringify({ niveau: "erreur", contexte: "documents.depot", message: erreurDepot.message }),
    );
    return { etat: "refus", message: "Le dépôt a échoué. Réessayez dans un instant." };
  }

  // Phase 3 — la finalisation. Elle passe par une fonction dediee, accordee au
  // seul role de service, qui enregistre ce qui a reellement ete verifie.
  const { error: erreurFinal } = await clientExploitation("stockage_des_supports").rpc(
    "finaliser_support_de_seance",
    {
      p_fichier: fileId,
      p_mime_detecte: type.mime,
      p_taille: octets.length,
      p_sha256: `\\x${empreinte}`,
    },
  );

  if (erreurFinal !== null) {
    await stockage.remove([cle]);
    await abandonner(options.jeton, fileId);
    console.error(
      JSON.stringify({ niveau: "erreur", contexte: "documents.finalisation", code: erreurFinal.code }),
    );
    return { etat: "refus", message: "Le document n'a pas pu être publié." };
  }

  return {
    etat: "ok",
    support: { fileId, nom, taille: octets.length, type },
  };
}

/**
 * Abandonne une reservation qui n'aboutira pas.
 *
 * La ligne est marquee supprimee plutot qu'effacee : on saura qu'un depot a ete
 * tente et qu'il a echoue. `files_guard_etat` laisse passer cette transition —
 * elle ne rend rien lisible.
 */
async function abandonner(jeton: string, fileId: string): Promise<void> {
  const { error } = await clientUtilisateur(jeton)
    .from("files")
    .update({ state: "supprime", deleted_at: new Date().toISOString() })
    .eq("id", fileId);

  if (error !== null) {
    console.error(
      JSON.stringify({ niveau: "erreur", contexte: "documents.abandon", code: error.code }),
    );
  }
}

export interface SupportLu {
  readonly nom: string;
  readonly mime: string;
  readonly octets: Buffer;
}

/**
 * Relit un support, si la personne y a droit.
 *
 * La ligne est lue avec le **jeton de la personne** : ce sont les politiques
 * `files_support_teacher` et `files_support_student` qui décident. Les octets,
 * eux, sont récupérés avec la clé de service — un bucket privé n'a pas d'autre
 * moyen — mais seulement après que RLS a répondu oui.
 *
 * `null` couvre indistinctement « n'existe pas » et « pas le droit » : la
 * différence n'a pas à transparaître.
 */
export async function lireSupport(jeton: string, fileId: string): Promise<SupportLu | null> {
  const { data, error } = await clientUtilisateur(jeton)
    .from("files")
    .select("display_name, storage_key, mime_detected, state")
    .eq("id", fileId)
    .maybeSingle();

  if (error !== null || data === null) return null;

  const ligne = data as unknown as {
    display_name: string;
    storage_key: string;
    mime_detected: string | null;
    state: string;
  };

  if (ligne.state !== "disponible") return null;

  const { data: objet, error: erreurObjet } = await clientExploitation("stockage_des_supports")
    .storage.from(BUCKET_SUPPORTS)
    .download(ligne.storage_key);

  if (erreurObjet !== null || objet === null) {
    console.error(
      JSON.stringify({ niveau: "erreur", contexte: "documents.lecture", message: erreurObjet?.message }),
    );
    return null;
  }

  return {
    nom: ligne.display_name,
    // Le type servi est celui que NOUS avons détecté, jamais celui déclaré au
    // dépôt : c'est la seule valeur dont nous répondons.
    mime: ligne.mime_detected ?? "application/octet-stream",
    octets: Buffer.from(await objet.arrayBuffer()),
  };
}


/* -------------------------------------------------------------------------- */
/* Copies, consignes et corrections                                            */
/* -------------------------------------------------------------------------- */

/** Les genres de pièce jointe que cette voie accepte. */
export type GenrePiece = "copie" | "consigne_devoir" | "correction";

/**
 * Dépose une pièce jointe qui n'est pas un support de séance.
 *
 * Les trois phases sont les mêmes que pour un support — réserver, transférer,
 * finaliser — et pour la même raison : à aucun moment il ne doit exister un
 * objet dans le stockage que rien ne désigne, ni une ligne en base qui
 * désigne un objet absent. La première situation remplit le stockage de
 * fichiers invisibles ; la seconde montre « remis » à un élève qui ne peut
 * rien retélécharger.
 *
 * Ce qui change : le genre et la ressource de rattachement, qui décident
 * ensuite — par les politiques RLS — de qui pourra ouvrir le fichier. Cette
 * fonction, elle, n'accorde aucun droit.
 */
export async function deposerPieceJointe(options: {
  jeton: string;
  organisation: string;
  proprietaire: string;
  genre: GenrePiece;
  rattachement: string;
  fichier: File;
}): Promise<ResultatDepot> {
  if (options.fichier.size === 0) {
    return { etat: "refus", message: "Ce fichier est vide." };
  }

  if (options.fichier.size > TAILLE_MAXIMALE_SUPPORT) {
    return {
      etat: "refus",
      message: `Ce fichier dépasse ${Math.round(TAILLE_MAXIMALE_SUPPORT / (1024 * 1024))} Mo.`,
    };
  }

  const octets = Buffer.from(await options.fichier.arrayBuffer());
  const type = reconnaitre(octets, options.fichier.type === "" ? null : options.fichier.type);

  if (type === null) {
    return {
      etat: "refus",
      message: `Ce format n'est pas accepté. Formats possibles : ${FORMATS_ACCEPTES}.`,
    };
  }

  const nom = nomLisible(options.fichier.name, type.extension);
  const empreinte = createHash("sha256").update(octets).digest("hex");
  const cle = `${options.organisation}/${options.rattachement}/${randomUUID()}`;

  const { data, error } = await clientUtilisateur(options.jeton)
    .from("files")
    .insert({
      organization_id: options.organisation,
      owner_id: options.proprietaire,
      display_name: nom,
      storage_key: cle,
      bucket: BUCKET_SUPPORTS,
      mime_declared: options.fichier.type === "" ? null : options.fichier.type,
      byte_size: 0,
      taille_annoncee: octets.length,
      state: "reserve",
      reserved_by: options.proprietaire,
      reserved_at: new Date().toISOString(),
      reservation_expire_at: new Date(Date.now() + 15 * 60 * 1000).toISOString(),
      attached_kind: options.genre,
      attached_id: options.rattachement,
    })
    .select("id")
    .single();

  if (error !== null || data === null) {
    console.error(
      JSON.stringify({ niveau: "erreur", contexte: "pieces.reservation", code: error?.code }),
    );
    return { etat: "refus", message: "Le fichier n'a pas pu être enregistré." };
  }

  const fileId = (data as { id: string }).id;
  const stockage = clientExploitation("stockage_des_supports").storage.from(BUCKET_SUPPORTS);

  const { error: erreurDepot } = await stockage.upload(cle, octets, {
    contentType: type.mime,
    upsert: false,
  });

  if (erreurDepot !== null) {
    await abandonner(options.jeton, fileId);
    console.error(
      JSON.stringify({ niveau: "erreur", contexte: "pieces.depot", message: erreurDepot.message }),
    );
    return { etat: "refus", message: "Le dépôt a échoué. Réessayez dans un instant." };
  }

  const { error: erreurFinal } = await clientExploitation("stockage_des_supports").rpc(
    "finaliser_piece_jointe",
    {
      p_fichier: fileId,
      p_mime_detecte: type.mime,
      p_taille: octets.length,
      p_sha256: `\\x${empreinte}`,
    },
  );

  if (erreurFinal !== null) {
    // L'objet est retiré du stockage **avant** d'abandonner la ligne : dans
    // l'autre ordre, un incident entre les deux laisserait un objet que plus
    // rien ne référence.
    await stockage.remove([cle]);
    await abandonner(options.jeton, fileId);
    console.error(
      JSON.stringify({ niveau: "erreur", contexte: "pieces.finalisation", code: erreurFinal.code }),
    );
    return { etat: "refus", message: "Le fichier n'a pas pu être enregistré." };
  }

  return { etat: "ok", support: { fileId, nom, taille: octets.length, type } };
}

/**
 * Retire un fichier devenu inutile après un remplacement réussi.
 *
 * L'ordre est l'inverse du dépôt, et il n'est pas négociable : on ne retire
 * l'ancienne version **qu'après** que la nouvelle est enregistrée. Supprimer
 * d'abord laisserait, en cas d'échec, un élève sans aucune copie — alors qu'il
 * en avait une.
 *
 * La ligne passe à « supprimé » plutôt que d'être effacée : la trace du dépôt
 * demeure, et c'est elle qui permet de répondre à « j'avais bien rendu ».
 */
export async function retirerPieceJointe(jeton: string, fileId: string): Promise<void> {
  await abandonner(jeton, fileId);
}
