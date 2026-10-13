import { csvErreursProfesseurs } from "@/lib/fichiers-import";
import { journaliserExport } from "@/lib/etablissement";
import { assuranceSuffisante } from "@/lib/garde-assurance";
import { lireLotProfesseurs } from "@/lib/lot-professeurs";
import { sessionCourante } from "@/lib/session-serveur";

/**
 * Lignes à corriger d'un lot de professeurs, en CSV (IMP-14). Mêmes règles
 * que pour les élèves : établissement relu en base, rôle et second facteur
 * revérifiés, aucun secret, aucun cache.
 */
export const dynamic = "force-dynamic";

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export async function GET(_requete: Request, { params }: { params: Promise<{ lot: string }> }): Promise<Response> {
  const personne = await sessionCourante();
  if (personne === null || !personne.roles.includes("admin_etablissement") || !(await assuranceSuffisante(personne))) {
    return new Response("Introuvable.", { status: 404 });
  }
  const { lot } = await params;
  if (!UUID.test(lot)) return new Response("Introuvable.", { status: 404 });
  const complet = await lireLotProfesseurs(personne.profileId, lot);
  if (complet === null) return new Response("Introuvable.", { status: 404 });
  if (!(await journaliserExport(personne.profileId, "lignes_import_profs", complet.lignes.length))) {
    return new Response("L'export n'a pas pu être journalisé ; il n'est pas servi.", { status: 503 });
  }

  return new Response(csvErreursProfesseurs(complet.lignes), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="professeurs-a-corriger-${lot.slice(0, 8)}.csv"`,
      "cache-control": "no-store, private",
    },
  });
}
