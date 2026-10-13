import { csv } from "@/lib/fichiers-import";
import { exportGroupes, journaliserExport } from "@/lib/etablissement";
import { assuranceSuffisante } from "@/lib/garde-assurance";
import { sessionCourante } from "@/lib/session-serveur";

/**
 * Export des appartenances aux groupes (GR-15), en CSV. Nominatif : rôle et
 * second facteur revérifiés, export journalisé avant d'être servi (SEC-19),
 * aucune mise en cache, aucun mot de passe.
 */
export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  const personne = await sessionCourante();
  if (personne === null || !personne.roles.includes("admin_etablissement") || !(await assuranceSuffisante(personne))) {
    return new Response("Introuvable.", { status: 404 });
  }
  const lignes = await exportGroupes(personne.profileId);
  if (lignes === null) return new Response("Introuvable.", { status: 404 });
  if (!(await journaliserExport(personne.profileId, "groupes", lignes.length))) {
    return new Response("L'export n'a pas pu être journalisé ; il n'est pas servi.", { status: 503 });
  }
  const contenu = csv(
    ["Groupe", "Type", "Année", "Identifiant", "Nom", "Prénom", "Classe", "Depuis le"],
    lignes.map((l) => [l.groupe, l.type === "interclasses" ? "Interclasses" : "Demi-groupe", l.annee, l.identifiant, l.nom, l.prenom, l.classe ?? "", l.depuis]),
  );
  return new Response(contenu, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="groupes-${new Date().toISOString().slice(0, 10)}.csv"`,
      "cache-control": "no-store, private",
    },
  });
}
