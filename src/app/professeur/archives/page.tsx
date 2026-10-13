import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { coursArchives } from "@/lib/archives-professeur";
import { jetonAccesDe, sessionCourante } from "@/lib/session-serveur";
import { VueArchivesProfesseur } from "./vue";

export const metadata: Metadata = { title: "Années passées" };

/**
 * Années passées — cahier des charges ch. 18 (YR-09). Les cours archivés que
 * la personne enseignait, en lecture seule ; la base décide (0076).
 */
export const dynamic = "force-dynamic";

export default async function PageArchivesProfesseur() {
  const personne = await sessionCourante();
  if (personne === null) redirect("/connexion");
  const jeton = await jetonAccesDe(personne);
  if (jeton === null) redirect("/connexion");
  return <VueArchivesProfesseur cours={await coursArchives(jeton)} />;
}
