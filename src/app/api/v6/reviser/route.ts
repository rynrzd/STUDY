import { NextResponse } from "next/server";
import { jetonAccesDe, sessionCourante } from "@/lib/session-serveur";
import { revisionsDesDevoirs } from "@/lib/revision/devoirs";

export const dynamic = "force-dynamic";

export async function GET() {
  const personne = await sessionCourante();
  const headers = { "cache-control": "private, no-store" };
  if (!personne || personne.activationRequise || !personne.roles.includes("eleve")) {
    return NextResponse.json({ erreur: "NON_ACCESSIBLE" }, { status: 401, headers });
  }
  const jeton = await jetonAccesDe(personne);
  if (!jeton) return NextResponse.json({ erreur: "NON_ACCESSIBLE" }, { status: 401, headers });
  const recommandations = await revisionsDesDevoirs(jeton);
  if (recommandations === null) {
    return NextResponse.json({ erreur: "INDISPONIBLE" }, { status: 503, headers });
  }
  return NextResponse.json({ recommandations }, { headers });
}
