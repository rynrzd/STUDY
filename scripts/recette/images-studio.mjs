/**
 * Inventory of Studio image sidecars. They have no `study.files` row: the
 * immutable content version references their content-addressed private key.
 * Only this exact constrained format can be treated as a known storage object.
 */
const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}";
const REF = new RegExp(`^studio-img:(${UUID}):(${UUID}):([0-9a-f]{64}):(png|jpg)$`, "i");

export function cheminImageStudio(reference, organisation) {
  const trouve = REF.exec(reference);
  if (!trouve || trouve[1].toLowerCase() !== organisation.toLowerCase()) return null;
  return `${trouve[1].toLowerCase()}/${trouve[2].toLowerCase()}/studio-images/${trouve[3].toLowerCase()}.${trouve[4].toLowerCase()}`;
}

/** The query is read-only and never fetches raw PDF/DOCX or binary images. */
export async function clesImagesStudio(sql, organisation = null) {
  const { rows } = await sql.query(
    `select cv.organization_id, cv.studio_document_id, cv.created_by,
            bloc ->> 'fileId' as reference
       from study.content_versions cv
       cross join lateral jsonb_array_elements(
         case when jsonb_typeof(cv.body -> 'document' -> 'blocs') = 'array'
           then cv.body -> 'document' -> 'blocs' else '[]'::jsonb end
       ) as bloc
      where bloc ->> 'type' = 'image'
        and ($1::uuid is null or cv.organization_id = $1::uuid)`,
    [organisation],
  );
  const candidates = [];
  const documents = new Set();
  for (const ligne of rows) {
    const chemin = cheminImageStudio(ligne.reference ?? "", ligne.organization_id);
    if (!chemin) continue;
    const doc = REF.exec(ligne.reference)[2].toLowerCase();
    if (ligne.studio_document_id && ligne.studio_document_id.toLowerCase() !== doc) continue;
    candidates.push({ chemin, doc, organisation: ligne.organization_id, auteur: ligne.created_by });
    documents.add(doc);
  }
  if (documents.size === 0) return new Set();
  const { rows: auteurs } = await sql.query(
    "select id, organization_id, owner_id from study.studio_documents where id = any($1::uuid[])",
    [[...documents]],
  );
  const proprietaires = new Map(auteurs.map((d) => [d.id.toLowerCase(), d]));
  const cles = new Set();
  for (const candidat of candidates) {
    const auteur = proprietaires.get(candidat.doc);
    if (auteur?.owner_id !== candidat.auteur || auteur.organization_id !== candidat.organisation) continue;
    cles.add(candidat.chemin);
  }
  return cles;
}
