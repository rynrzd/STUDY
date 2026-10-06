import { NextResponse } from "next/server";
import { ErreurRecherche, GENRES, rechercher } from "@/lib/recherche/service";
import type { GenreResultat } from "@/lib/recherche/moteur";
import { jetonAccesDe, sessionCourante } from "@/lib/session-serveur";

/**
 * GET /api/v6/recherche — dossier V6, §7.3 et contrat SearchResponse.
 * Identité relue en base ; la sélection et la revalidation sont faites par
 * `study.recherche` sous le jeton de la personne. Réponse jamais mise en cache.
 */
export const dynamic = "force-dynamic";

const ENTETES = { "cache-control": "private, no-store" };

export async function GET(requete: Request) {
  const personne = await sessionCourante();
  if (personne === null || personne.activationRequise) {
    return NextResponse.json({ error: { code: "UNAUTHENTICATED", message: "Session terminée." } }, { status: 401, headers: ENTETES });
  }
  const jeton = await jetonAccesDe(personne);
  if (jeton === null) {
    return NextResponse.json({ error: { code: "UNAUTHENTICATED", message: "Session terminée." } }, { status: 401, headers: ENTETES });
  }
  const url = new URL(requete.url);
  const types = (url.searchParams.get("types") ?? "")
    .split(",")
    .filter((t): t is GenreResultat => (GENRES as readonly string[]).includes(t));
  const classe = url.searchParams.get("classe");
  try {
    const reponse = await rechercher(jeton, {
      q: url.searchParams.get("q") ?? "",
      types,
      classe: classe && /^[0-9a-f-]{36}$/iu.test(classe) ? classe : null,
      curseur: url.searchParams.get("curseur"),
    });
    return NextResponse.json(reponse, { headers: ENTETES });
  } catch (erreur) {
    const e = erreur instanceof ErreurRecherche ? erreur : null;
    const statut = e?.code === "NON_AUTHENTIFIE" ? 401 : 503;
    return NextResponse.json(
      {
        error: {
          code: statut === 401 ? "UNAUTHENTICATED" : "PROVIDER_UNAVAILABLE",
          message: "La recherche est momentanément indisponible. Réessayez dans un instant.",
          requestId: e?.requestId ?? null,
        },
      },
      { status: statut, headers: ENTETES },
    );
  }
}
