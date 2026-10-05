import { NextResponse } from "next/server";
import { cellule } from "@/lib/acces";
import { jetonAccesDe, sessionCourante } from "@/lib/session-serveur";
import { clientUtilisateur } from "@/lib/supabase-serveur";

/**
 * Export personnel du carnet d'erreurs (E23) : les données de l'élève, pour
 * l'élève. Cellules désamorcées contre l'injection de formule (§6.3).
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const personne = await sessionCourante();
  if (personne === null) return NextResponse.json({ error: { code: "UNAUTHENTICATED" } }, { status: 401 });
  const jeton = await jetonAccesDe(personne);
  if (jeton === null) return NextResponse.json({ error: { code: "UNAUTHENTICATED" } }, { status: 401 });
  const { data, error } = await clientUtilisateur(jeton).rpc("carnet_lire", { p_archivees: true });
  if (error !== null) return NextResponse.json({ error: { code: "SERVER_ERROR" } }, { status: 503 });
  const lignes = (data ?? []) as { notion: string | null; enonce: string; explication: string | null; categorie: string | null; note: string | null; created_at: string; archived_at: string | null }[];
  const csv = [
    ["Date", "Notion", "Énoncé", "Explication", "Catégorie", "Ma note", "Archivée"].map(cellule).join(";"),
    ...lignes.map((l) =>
      [l.created_at.slice(0, 10), l.notion ?? "", l.enonce, l.explication ?? "", l.categorie ?? "", l.note ?? "", l.archived_at ? "oui" : "non"].map(cellule).join(";"),
    ),
  ].join("\r\n");
  return new NextResponse(`﻿${csv}\r\n`, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": "attachment; filename=carnet-d-erreurs.csv",
      "cache-control": "private, no-store",
    },
  });
}
