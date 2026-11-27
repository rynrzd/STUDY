/** Reference format shared by server routes and the client-side Studio editor. */
const UUID = "[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}";
const REFERENCE = new RegExp(`^studio-img:(${UUID}):(${UUID}):([0-9a-f]{64}):(png|jpg)$`, "i");

export interface ImageStudio {
  readonly organisation: string;
  readonly document: string;
  readonly empreinte: string;
  readonly extension: "png" | "jpg";
  readonly mime: "image/png" | "image/jpeg";
  readonly cle: string;
}

export function analyserImageStudio(reference: string): ImageStudio | null {
  const match = REFERENCE.exec(reference);
  if (!match) return null;
  const [, organisation, document, empreinte, extension] = match;
  const ext = extension!.toLowerCase() as "png" | "jpg";
  return {
    organisation: organisation!.toLowerCase(),
    document: document!.toLowerCase(),
    empreinte: empreinte!.toLowerCase(),
    extension: ext,
    mime: ext === "png" ? "image/png" : "image/jpeg",
    cle: `${organisation!.toLowerCase()}/${document!.toLowerCase()}/studio-images/${empreinte!.toLowerCase()}.${ext}`,
  };
}

export function urlImageStudio(version: string | undefined, reference: string | null): string | null {
  if (!version || !/^[0-9a-f-]{36}$/i.test(version) || !reference || !analyserImageStudio(reference)) return null;
  return `/images-studio/${version}/${reference}`;
}
