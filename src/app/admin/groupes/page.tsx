import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { contexte, groupes } from "@/lib/etablissement";
import { sessionCourante } from "@/lib/session-serveur";
import { VueGroupes } from "./vue";

export const metadata: Metadata = { title: "Groupes" };

/**
 * Groupes pédagogiques — cahier des charges, ch. 07.
 *
 * Les groupes (spécialités interclasses, demi-groupes, langues) réunissent des
 * élèves choisis explicitement. Toute écriture passe par les fonctions
 * `study.etab_*` qui recalculent l'établissement en base ; la page ne protège
 * que l'affichage.
 */
export const dynamic = "force-dynamic";

export default async function PageGroupes() {
  const personne = await sessionCourante();
  if (personne === null) redirect("/connexion");

  const situation = await contexte(personne.profileId);
  if (situation === null) redirect("/admin");

  const liste = await groupes(personne.profileId);
  return <VueGroupes liste={liste} />;
}
