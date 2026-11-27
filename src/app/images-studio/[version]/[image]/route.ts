import { NextResponse } from "next/server";
import { lireImageVersion } from "@/lib/lecture-images-studio";
import { jetonAccesDe, sessionCourante } from "@/lib/session-serveur";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** No public/signed URL: this response is protected by content-version RLS. */
export async function GET(
  _requete: Request,
  { params }: { params: Promise<{ version: string; image: string }> },
) {
  const personne = await sessionCourante();
  if (!personne || personne.activationRequise) return NextResponse.json({ erreur: "introuvable" }, { status: 404 });
  const jeton = await jetonAccesDe(personne);
  if (!jeton) return NextResponse.json({ erreur: "introuvable" }, { status: 404 });
  const { version, image } = await params;
  const resultat = await lireImageVersion(jeton, version, image);
  if (!resultat) return NextResponse.json({ erreur: "introuvable" }, { status: 404 });

  return new NextResponse(new Uint8Array(resultat.octets), {
    headers: {
      "content-type": resultat.mime,
      "content-length": String(resultat.octets.length),
      "content-disposition": "inline",
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
      "cross-origin-resource-policy": "same-origin",
      "content-security-policy": "default-src 'none'; sandbox",
    },
  });
}
