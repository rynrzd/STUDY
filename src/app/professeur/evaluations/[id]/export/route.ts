import { NextResponse } from "next/server";
import { exportNotes } from "@/lib/evaluations/analyse";
import { jetonAccesDe, sessionCourante } from "@/lib/session-serveur";
import { evaluationDuProfesseur, suiviEvaluation } from "@/lib/v6/evaluations";

/**
 * Export des résultats pour Pronote ou un tableur : Nom ; Prénom ; Note ;
 * Maîtrise, en UTF-8 avec BOM (Excel le lit sans brouiller les accents).
 * Lu sous le jeton du professeur : RLS décide.
 */
export const dynamic = "force-dynamic";

export async function GET(_r: Request, { params }: { params: Promise<{ id: string }> }) {
  const personne = await sessionCourante();
  if (personne === null) return NextResponse.json({ erreur: "session expiree" }, { status: 401 });
  const jeton = await jetonAccesDe(personne);
  if (jeton === null) return NextResponse.json({ erreur: "session expiree" }, { status: 401 });
  const { id } = await params;
  const prof = await evaluationDuProfesseur(jeton, id);
  if (prof === null) return NextResponse.json({ erreur: "introuvable" }, { status: 404 });
  const suivi = await suiviEvaluation(jeton, prof);
  const nom = prof.evaluation.titre.normalize("NFD").replace(/[^\w\s-]/g, "").trim().replace(/\s+/g, "-").slice(0, 60) || "evaluation";
  return new NextResponse(`﻿${exportNotes(suivi.analyse.eleves, prof.evaluation.notation)}\r\n`, {
    headers: {
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="${nom}.csv"`,
      "cache-control": "private, no-store",
    },
  });
}
