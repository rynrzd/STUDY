import { MODELES } from "@/lib/fichiers-import";
import { sessionCourante } from "@/lib/session-serveur";

/**
 * Modèle de fichier d'import (IMP-14) : `?type=eleves` ou `?type=professeurs`.
 * Aucune donnée réelle : des colonnes et deux lignes d'exemple. Réservé
 * malgré tout aux administrateurs, comme le reste de l'import.
 */
export const dynamic = "force-dynamic";

export async function GET(requete: Request): Promise<Response> {
  const personne = await sessionCourante();
  if (personne === null || !personne.roles.includes("admin_etablissement")) {
    return new Response("Introuvable.", { status: 404 });
  }
  const type = new URL(requete.url).searchParams.get("type");
  const modele = type === "professeurs" ? MODELES.professeurs : type === "groupes" ? MODELES.groupes : MODELES.eleves;
  return new Response(modele.contenu, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${modele.nom}"`,
      "cache-control": "no-store, private",
    },
  });
}
