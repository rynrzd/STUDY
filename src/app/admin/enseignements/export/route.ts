import { csv } from "@/lib/fichiers-import";
import { journaliserExport, matriceEnseignements } from "@/lib/etablissement";
import { assuranceSuffisante } from "@/lib/garde-assurance";
import { sessionCourante } from "@/lib/session-serveur";

/**
 * Export de « Qui enseigne quoi » (ENS-10) : une ligne par enseignement, avec
 * ses intervenants et leur rôle. Aucun identifiant technique ; journalisé.
 */
export const dynamic = "force-dynamic";

const ROLES: Record<string, string> = { titulaire: "titulaire", co_intervenant: "co-intervenant", remplacant: "remplaçant" };

export async function GET(): Promise<Response> {
  const personne = await sessionCourante();
  if (personne === null || !personne.roles.includes("admin_etablissement") || !(await assuranceSuffisante(personne))) {
    return new Response("Introuvable.", { status: 404 });
  }
  const lignes = await matriceEnseignements(personne.profileId);
  if (lignes === null) return new Response("Introuvable.", { status: 404 });
  if (!(await journaliserExport(personne.profileId, "enseignements", lignes.length))) {
    return new Response("L'export n'a pas pu être journalisé ; il n'est pas servi.", { status: 503 });
  }
  const contenu = csv(
    ["Classe ou groupe", "Type", "Matière", "Professeurs"],
    lignes.map((e) => [
      e.cible_label,
      e.genre === "classe" ? "Classe" : "Groupe",
      e.matiere_label,
      e.intervenants.length === 0 ? "Sans professeur" : e.intervenants.map((i) => `${i.nom} (${ROLES[i.role] ?? i.role})`).join(", "),
    ]),
  );
  return new Response(contenu, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="qui-enseigne-quoi-${new Date().toISOString().slice(0, 10)}.csv"`,
      "cache-control": "no-store, private",
    },
  });
}
