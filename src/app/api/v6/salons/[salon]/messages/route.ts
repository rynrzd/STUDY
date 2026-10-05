import { NextResponse } from "next/server";
import { jetonAccesDe, sessionCourante } from "@/lib/session-serveur";
import { idRequete } from "@/lib/v6/contexte";
import { pageMessages } from "@/lib/v6/messagerie";

/**
 * GET /api/v6/salons/:salon/messages — relecture d'un salon (E09).
 *
 * Le client la rappelle à intervalle régulier : chaque appel relit les droits
 * actuels. Un membre retiré reçoit 403 dès l'appel suivant et l'interface
 * efface ce qu'elle affichait ; une session expirée reçoit 401 et le
 * brouillon reste sur l'appareil. Aucune mise en cache intermédiaire.
 */
export const dynamic = "force-dynamic";

const ENTETES = { "cache-control": "private, no-store" };

export async function GET(requete: Request, { params }: { params: Promise<{ salon: string }> }) {
  const requestId = idRequete();
  const personne = await sessionCourante();
  if (personne === null || personne.activationRequise) {
    return NextResponse.json({ error: { code: "UNAUTHENTICATED", message: "Session terminée.", requestId } }, { status: 401, headers: ENTETES });
  }
  const jeton = await jetonAccesDe(personne);
  if (jeton === null) {
    return NextResponse.json({ error: { code: "UNAUTHENTICATED", message: "Session terminée.", requestId } }, { status: 401, headers: ENTETES });
  }
  const { salon } = await params;
  if (!/^[0-9a-f-]{36}$/iu.test(salon)) {
    return NextResponse.json({ error: { code: "NOT_ACCESSIBLE", message: "Ce contenu n'est pas accessible.", requestId } }, { status: 403, headers: ENTETES });
  }
  const url = new URL(requete.url);
  const fil = url.searchParams.get("fil");
  const page = await pageMessages(jeton, personne.profileId, salon, {
    avant: url.searchParams.get("avant"),
    apres: url.searchParams.get("apres"),
    fil: fil && /^[0-9a-f-]{36}$/iu.test(fil) ? fil : null,
  });
  if (!page.accessible) {
    return NextResponse.json({ error: { code: "NOT_ACCESSIBLE", message: "Ce contenu n'est pas accessible.", requestId } }, { status: 403, headers: ENTETES });
  }
  return NextResponse.json(page, { headers: ENTETES });
}
