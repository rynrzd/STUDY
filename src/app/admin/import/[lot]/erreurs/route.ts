import { csvErreursEleves } from "@/lib/fichiers-import";
import { assuranceSuffisante } from "@/lib/garde-assurance";
import { lireLot } from "@/lib/lot-rentree";
import { sessionCourante } from "@/lib/session-serveur";

/**
 * Lignes à corriger d'un lot d'élèves, en CSV (IMP-14). Le lot est relu pour
 * l'établissement de la personne connectée : un identifiant d'un autre lycée
 * répond comme s'il n'existait pas. Contient des noms d'élèves : rôle et
 * second facteur sont revérifiés ici, et rien n'est mis en cache.
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
  const complet = await lireLot(personne.profileId, lot);
  if (complet === null) return new Response("Introuvable.", { status: 404 });

  return new Response(csvErreursEleves(complet.lignes), {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="lignes-a-corriger-${lot.slice(0, 8)}.csv"`,
      "cache-control": "no-store, private",
    },
  });
}
