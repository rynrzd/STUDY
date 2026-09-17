import { timingSafeEqual } from "node:crypto";
import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import { drainer } from "@/lib/travaux";

/**
 * Traitement de la file — cahier « Refonte fidèle », T03 et T04.
 *
 * Deux appelants, un seul chemin :
 *
 *  - la tâche planifiée de l'hébergeur, toutes les minutes, qui rattrape les
 *    réessais et les travaux qu'un budget de temps a laissés derrière ;
 *  - le dépôt d'un document, qui réveille le drain immédiatement — le
 *    professeur regarde l'écran de progression, attendre la minute suivante
 *    serait absurde.
 *
 * L'accès est réservé au porteur de `CRON_SECRET`. La comparaison se fait à
 * temps constant : une comparaison naïve fuit la longueur du préfixe correct,
 * et un secret se devine caractère par caractère quand on a la patience.
 *
 * Cette route n'est pas une mutation de navigateur : elle ne touche à aucun
 * cookie, ne lit aucune session, et n'est jamais appelée depuis une page. Le
 * garde-fou CSRF ne s'y applique pas — c'est le secret qui authentifie.
 */
export const dynamic = "force-dynamic";

// Pas de `maxDuration` déclaré : la valeur autorisée dépend du plan de
// l'hébergeur, et une valeur trop haute fait échouer le déploiement entier —
// c'est arrivé. Le drain s'aligne donc sur la borne la plus basse (10 s) et
// rend la main bien avant. Sur un plan plus large, augmenter le budget ici
// suffit ; rien d'autre ne change.

function secretValide(entete: string | null): boolean {
  const attendu = (process.env.CRON_SECRET ?? "").trim();
  if (attendu === "") return false;

  const fourni = (entete ?? "").replace(/^Bearer\s+/i, "").trim();
  if (fourni === "") return false;

  // Les empreintes ont toujours la même longueur : `timingSafeEqual` refuse
  // deux tampons de tailles différentes, ce qui fuirait déjà la longueur.
  const a = createHash("sha256").update(attendu, "utf8").digest();
  const b = createHash("sha256").update(fourni, "utf8").digest();
  return timingSafeEqual(a, b);
}

export async function POST(requete: Request) {
  if (!secretValide(requete.headers.get("authorization"))) {
    // Pas de détail : ni « secret absent », ni « secret faux ».
    return NextResponse.json({ erreur: "refuse" }, { status: 401 });
  }

  const bilan = await drainer({ budgetMs: 8_000, nom: "bff" });

  return NextResponse.json(bilan, {
    headers: { "cache-control": "private, no-store" },
  });
}

/**
 * Les tâches planifiées de Vercel appellent en GET.
 *
 * Même porte, même secret : le verbe change, la vérification non.
 */
export async function GET(requete: Request) {
  return POST(requete);
}
