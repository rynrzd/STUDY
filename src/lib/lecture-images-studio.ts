import "server-only";

import { relireDocument } from "./document-cours.ts";
import { analyserImageStudio, imageStudioAuthentique } from "./images-studio.ts";
import { clientExploitation, clientUtilisateur } from "./supabase-serveur.ts";

/**
 * Reads a private illustration ONLY after RLS grants access to this exact
 * content version and its JSON actually references the image. A copied token
 * in another professor's draft is not sufficient: the version must originate
 * from the owner of the Studio document hosting the binary.
 */
export async function lireImageVersion(
  jeton: string,
  versionId: string,
  reference: string,
): Promise<{ mime: "image/png" | "image/jpeg"; octets: Buffer } | null> {
  const image = analyserImageStudio(reference);
  if (!image || !/^[0-9a-f-]{36}$/i.test(versionId)) return null;

  const { data: version, error: erreurVersion } = await clientUtilisateur(jeton)
    .from("content_versions")
    .select("organization_id, created_by, studio_document_id, body")
    .eq("id", versionId)
    .maybeSingle();
  if (erreurVersion || !version) return null;

  const ligne = version as {
    organization_id: string;
    created_by: string;
    studio_document_id: string | null;
    body: unknown;
  };
  if (ligne.organization_id !== image.organisation ||
      (ligne.studio_document_id && ligne.studio_document_id !== image.document)) return null;

  const corps = typeof ligne.body === "object" && ligne.body !== null
    ? ligne.body as Record<string, unknown> : {};
  const document = relireDocument(corps.document);
  if (!document?.blocs.some((bloc) => bloc.type === "image" && bloc.fileId === reference)) return null;

  const service = clientExploitation("stockage_des_supports");
  const { data: origine, error: erreurOrigine } = await service
    .from("studio_documents")
    .select("organization_id, owner_id")
    .eq("id", image.document)
    .maybeSingle();
  if (erreurOrigine || !origine || origine.organization_id !== image.organisation ||
      origine.owner_id !== ligne.created_by) return null;

  const { data: objet, error: erreurObjet } = await service.storage
    .from("course-materials")
    .download(image.cle);
  if (erreurObjet || !objet || objet.size > 3 * 1024 * 1024) return null;

  const octets = Buffer.from(await objet.arrayBuffer());
  if (!imageStudioAuthentique(octets, image)) return null;
  return { mime: image.mime, octets };
}
