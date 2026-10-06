import { NextResponse } from "next/server";
import { texteDuBloc } from "@/lib/document-cours";
import { jetonAccesDe, sessionCourante } from "@/lib/session-serveur";
import { seanceDetail } from "@/lib/v6/cours";

/**
 * Texte d'une séance pour une copie hors ligne choisie (§10). Rien d'autre
 * que le cours : ni note, ni message, ni exercice corrigé. Sert aussi à
 * revalider les copies au retour du réseau : 404 → la copie est effacée.
 */
export const dynamic = "force-dynamic";
const ENTETES = { "cache-control": "private, no-store" };

export async function GET(_r: Request, { params }: { params: Promise<{ id: string }> }) {
  const personne = await sessionCourante();
  if (personne === null) return NextResponse.json({ error: { code: "UNAUTHENTICATED" } }, { status: 401, headers: ENTETES });
  const jeton = await jetonAccesDe(personne);
  if (jeton === null) return NextResponse.json({ error: { code: "UNAUTHENTICATED" } }, { status: 401, headers: ENTETES });
  const { id } = await params;
  const s = await seanceDetail(jeton, id);
  if (s === null || s.etat !== "publiee") return NextResponse.json({ error: { code: "NOT_ACCESSIBLE" } }, { status: 404, headers: ENTETES });
  const paragraphes = [
    ...(s.document?.document.blocs.map((b) => texteDuBloc(b)) ?? []),
    ...s.blocs.map((b) => String(b.contenu.texte ?? b.contenu.consigne ?? b.contenu.titre ?? "")),
  ].filter((t) => t.trim().length > 0);
  return NextResponse.json(
    { id: s.id, titre: s.titre, matiere: s.matiere, version: s.versionNumero, publieeLe: s.publieeLe, paragraphes },
    { headers: ENTETES },
  );
}
