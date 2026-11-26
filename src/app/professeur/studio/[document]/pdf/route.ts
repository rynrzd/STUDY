import { NextResponse } from "next/server";
import { fabriquerPdfCours, nomPdf } from "@/lib/export-pdf";
import { jetonAccesDe, sessionCourante } from "@/lib/session-serveur";
import { document as lireDocument, revision } from "@/lib/studio-documents";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

/** Export privé de la révision courante : l'URL ne confère jamais le droit. */
export async function GET(
  requete: Request,
  { params }: { params: Promise<{ document: string }> },
) {
  const personne = await sessionCourante();
  if (personne === null || personne.activationRequise) {
    return NextResponse.json({ erreur: "introuvable" }, { status: 404 });
  }
  const jeton = await jetonAccesDe(personne);
  if (jeton === null) return NextResponse.json({ erreur: "session expiree" }, { status: 401 });

  const { document: id } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/iu.test(id)) {
    return NextResponse.json({ erreur: "introuvable" }, { status: 404 });
  }

  // La révision fournie par l’aperçu sert uniquement à vérifier sa fraîcheur.
  // Le document autorisé par RLS désigne la révision à charger.
  const doc = await lireDocument(jeton, id);
  if (doc === null || doc.revisionId === null) {
    return NextResponse.json({ erreur: "introuvable" }, { status: 404 });
  }
  const attendue = new URL(requete.url).searchParams.get("revision");
  if (attendue && attendue !== doc.revisionId) {
    return new NextResponse("La révision a changé. Rechargez l’aperçu avant de télécharger.", {
      status: 409,
      headers: { "content-type": "text/plain; charset=utf-8", "cache-control": "private, no-store" },
    });
  }
  const courante = await revision(jeton, doc.revisionId);
  if (courante === null) return NextResponse.json({ erreur: "introuvable" }, { status: 404 });

  const octets = await fabriquerPdfCours(courante.document, courante.reglages);
  const nom = nomPdf(courante.document.titre);
  return new NextResponse(new Uint8Array(octets), {
    headers: {
      "content-type": "application/pdf",
      "content-length": String(octets.length),
      "content-disposition": `attachment; filename*=UTF-8''${encodeURIComponent(nom)}`,
      "cache-control": "private, no-store",
      "x-content-type-options": "nosniff",
      "content-security-policy": "default-src 'none'; sandbox",
    },
  });
}
