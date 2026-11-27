import { createHash } from "node:crypto";
import type { ImageStudio } from "./images-studio-reference.ts";

export { analyserImageStudio } from "./images-studio-reference.ts";

/**
 * References to DOCX illustrations are not URLs or storage keys. A version
 * must be readable under RLS before a server route resolves one of them.
 * Nothing binary is copied into the JSON of a course or into client props.
 */
export const MAX_IMAGES_DOCX = 24;
export const MAX_OCTETS_IMAGE = 3 * 1024 * 1024;
export const MAX_OCTETS_IMAGES = 12 * 1024 * 1024;

/** Only signature-verified PNG/JPEG files are suitable for both web and PDFKit. */
export function imageDocxValide(octets: Buffer, typeDeclare: string): "png" | "jpg" | null {
  if (octets.length < 24 || octets.length > MAX_OCTETS_IMAGE) return null;
  if (typeDeclare === "image/png" &&
      octets.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])) &&
      octets.toString("ascii", 12, 16) === "IHDR") {
    const largeur = octets.readUInt32BE(16);
    const hauteur = octets.readUInt32BE(20);
    if (largeur > 0 && hauteur > 0 && largeur <= 6000 && hauteur <= 6000 && largeur * hauteur <= 16_000_000) return "png";
  }
  if (typeDeclare === "image/jpeg" && octets[0] === 0xff && octets[1] === 0xd8 &&
      octets[octets.length - 2] === 0xff && octets[octets.length - 1] === 0xd9) {
    // SOF markers declare the decoded dimensions. Reject decompression bombs
    // before asking PDFKit or the browser to open the image.
    let position = 2;
    while (position + 4 < octets.length) {
      if (octets[position++] !== 0xff) return null;
      while (octets[position] === 0xff) position += 1;
      const marqueur = octets[position++]!;
      if (marqueur === 0xda || marqueur === 0xd9) break;
      if (marqueur === 0x01 || (marqueur >= 0xd0 && marqueur <= 0xd8)) continue;
      if (position + 2 > octets.length) return null;
      const longueur = octets.readUInt16BE(position);
      if (longueur < 2 || position + longueur > octets.length) return null;
      if ([0xc0, 0xc1, 0xc2, 0xc3, 0xc5, 0xc6, 0xc7, 0xc9, 0xca, 0xcb, 0xcd, 0xce, 0xcf].includes(marqueur)) {
        if (longueur < 7) return null;
        const hauteur = octets.readUInt16BE(position + 3);
        const largeur = octets.readUInt16BE(position + 5);
        return largeur > 0 && hauteur > 0 && largeur <= 6000 && hauteur <= 6000 && largeur * hauteur <= 16_000_000
          ? "jpg" : null;
      }
      position += longueur;
    }
  }
  return null;
}

export function referenceImageStudio(organisation: string, document: string, octets: Buffer, extension: "png" | "jpg"): string {
  const empreinte = createHash("sha256").update(octets).digest("hex");
  return `studio-img:${organisation}:${document}:${empreinte}:${extension}`;
}

export function imageStudioAuthentique(octets: Buffer, image: ImageStudio): boolean {
  return imageDocxValide(octets, image.mime) === image.extension &&
    createHash("sha256").update(octets).digest("hex") === image.empreinte;
}
