import { NextResponse } from "next/server";
import { lireSupport } from "@/lib/documents";
import { jetonAccesDe, sessionCourante } from "@/lib/session-serveur";

/**
 * Téléchargement d'un support de séance — cahier V2, §12.
 *
 * Le fichier ne transite jamais par une URL signée du stockage : il passe par
 * ici. C'est plus coûteux, et c'est le seul moyen d'appliquer la règle
 * d'accès à chaque requête plutôt qu'au moment où le lien a été fabriqué. Une
 * URL signée reste valide même après qu'une séance a été dépubliée, ou qu'un
 * élève a changé d'établissement.
 *
 * La réponse est toujours une pièce jointe, jamais un rendu en ligne : un PDF
 * ou une image piégés s'ouvrent alors dans le lecteur de la personne, pas dans
 * l'origine de l'application, où ils pourraient lire une session.
 */
export const dynamic = "force-dynamic";

export async function GET(
  _requete: Request,
  { params }: { params: Promise<{ fichier: string }> },
) {
  const personne = await sessionCourante();
  if (personne === null || personne.activationRequise) {
    return NextResponse.redirect(new URL("/connexion", process.env.APP_ORIGIN ?? "http://localhost:3100"));
  }

  const jeton = await jetonAccesDe(personne);
  if (jeton === null) {
    return NextResponse.json({ erreur: "session expiree" }, { status: 401 });
  }

  const { fichier } = await params;
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(fichier)) {
    return NextResponse.json({ erreur: "introuvable" }, { status: 404 });
  }

  const support = await lireSupport(jeton, fichier);

  // « Pas le droit » et « n'existe pas » donnent la même réponse : distinguer
  // les deux apprendrait quels documents existent.
  if (support === null) {
    return NextResponse.json({ erreur: "introuvable" }, { status: 404 });
  }

  return new NextResponse(new Uint8Array(support.octets), {
    status: 200,
    headers: {
      "content-type": support.mime,
      "content-length": String(support.octets.length),
      // `filename*` en UTF-8 : les accents d'un nom de fichier français ne
      // passent pas dans un en-tête HTTP autrement.
      "content-disposition": `attachment; filename*=UTF-8''${encodeURIComponent(support.nom)}`,
      "x-content-type-options": "nosniff",
      // Un document scolaire n'a aucune raison d'être mis en cache par un
      // intermédiaire : il est nominatif par son autorisation.
      "cache-control": "private, no-store",
      "content-security-policy": "default-src 'none'; sandbox",
    },
  });
}
