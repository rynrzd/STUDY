import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { contexte, matriceEnseignements } from "@/lib/etablissement";
import { sessionCourante } from "@/lib/session-serveur";
import { VueEnseignements, type FiltresEnseignements } from "./vue";

export const metadata: Metadata = { title: "Qui enseigne quoi" };

/**
 * Vue d'ensemble des enseignements — cahier des charges ch. 09 (ENS-02) :
 * classe ou groupe × matière × professeur, filtrable par niveau. Lecture
 * seule ; les gestes restent sur « Classes et cours » et les fiches.
 */
export const dynamic = "force-dynamic";

export default async function PageEnseignements({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const personne = await sessionCourante();
  if (personne === null) redirect("/connexion");
  if ((await contexte(personne.profileId)) === null) redirect("/admin");

  const p = await searchParams;
  const filtres: FiltresEnseignements = {
    niveau: p.niveau === "2" || p.niveau === "1" || p.niveau === "t" || p.niveau === "groupes" || p.niveau === "autres" ? p.niveau : "",
    professeur: (p.professeur ?? "").slice(0, 120),
    vacants: p.vacants === "oui",
  };
  return <VueEnseignements enseignements={await matriceEnseignements(personne.profileId)} filtres={filtres} />;
}
