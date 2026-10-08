import { NextResponse } from "next/server";
import { secretTacheValide } from "@/lib/secret-tache";
import { clientExploitation } from "@/lib/supabase-serveur";

/**
 * Sonde d'état — dossier de sécurité, chapitre 10, recommandations 1 et 2
 * (risque R-09 : personne n'est prévenu automatiquement).
 *
 * Deux lectures, une seule porte :
 *  - **sans secret** (sonde de disponibilité externe) : `200 {"etat":"ok"}`
 *    si l'application répond et que la base est joignable, `503
 *    {"etat":"degrade"}` sinon. Aucun chiffre, aucun nom, aucune donnée ;
 *  - **avec `Authorization: Bearer <CRON_SECRET>`** : en plus, le nombre de
 *    travaux en retard (en attente depuis plus de 15 minutes) et en échec sur
 *    24 heures. `503` si la file stagne, pour qu'une sonde puisse alerter
 *    dessus. Toujours aucune donnée personnelle : des comptes, rien d'autre.
 *
 * GET seulement, sans cookie ni session ; jamais mis en cache.
 */
export const dynamic = "force-dynamic";

const ENTETES = { "cache-control": "no-store", "x-content-type-options": "nosniff" };
const RETARD_MINUTES = 15;

export async function GET(requete: Request) {
  const detaille = secretTacheValide(requete.headers.get("authorization"));
  let client: ReturnType<typeof clientExploitation>;
  try {
    client = clientExploitation("tache_planifiee");
  } catch {
    return NextResponse.json({ etat: "degrade" }, { status: 503, headers: ENTETES });
  }

  const ping = await client.from("jobs").select("id", { count: "exact", head: true }).limit(1);
  if (ping.error !== null) {
    console.error(JSON.stringify({ niveau: "erreur", contexte: "etat.base", code: ping.error.code ?? "inconnu" }));
    return NextResponse.json({ etat: "degrade" }, { status: 503, headers: ENTETES });
  }
  if (!detaille) return NextResponse.json({ etat: "ok" }, { headers: ENTETES });

  const limite = new Date(Date.now() - RETARD_MINUTES * 60_000).toISOString();
  const veille = new Date(Date.now() - 24 * 3_600_000).toISOString();
  const [retard, echecs] = await Promise.all([
    client.from("jobs").select("id", { count: "exact", head: true }).eq("state", "en_attente").lt("run_after", limite),
    client.from("jobs").select("id", { count: "exact", head: true }).eq("state", "echoue").gt("created_at", veille),
  ]);
  if (retard.error !== null || echecs.error !== null) {
    return NextResponse.json({ etat: "degrade", detail: "lecture_file_impossible" }, { status: 503, headers: ENTETES });
  }
  const enRetard = retard.count ?? 0;
  const etat = enRetard > 0 ? "file_en_retard" : "ok";
  return NextResponse.json(
    { etat, travaux_en_retard: enRetard, travaux_echoues_24h: echecs.count ?? 0, seuil_retard_minutes: RETARD_MINUTES },
    { status: enRetard > 0 ? 503 : 200, headers: ENTETES },
  );
}
