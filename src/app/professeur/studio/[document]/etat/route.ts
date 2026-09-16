import { NextResponse } from "next/server";
import { jetonAccesDe, sessionCourante } from "@/lib/session-serveur";
import { document as lireDocument } from "@/lib/studio-documents";

/**
 * État d'un import, pour le suivi à l'écran — S05.
 *
 * Une route plutôt qu'une action serveur : c'est une lecture, elle se fait en
 * GET, elle ne change rien. Elle rend trois champs et rien de plus — pas le
 * contenu du cours, pas le chemin du fichier, pas l'identifiant du job.
 *
 * La lecture passe par le jeton du professeur : un document qui n'est pas le
 * sien répond 404, comme s'il n'existait pas.
 */
export const dynamic = "force-dynamic";

export async function GET(
  _requete: Request,
  { params }: { params: Promise<{ document: string }> },
) {
  const personne = await sessionCourante();
  if (personne === null || personne.activationRequise) {
    return NextResponse.json({ erreur: "session" }, { status: 401 });
  }

  const jeton = await jetonAccesDe(personne);
  if (jeton === null) return NextResponse.json({ erreur: "session" }, { status: 401 });

  const { document: id } = await params;
  const doc = await lireDocument(jeton, id);
  if (doc === null) return NextResponse.json({ erreur: "introuvable" }, { status: 404 });

  return NextResponse.json(
    { etat: doc.etat, erreur: doc.erreur },
    { headers: { "cache-control": "private, no-store" } },
  );
}
