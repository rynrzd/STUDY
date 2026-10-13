import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { contexte, groupes, groupesDetails } from "@/lib/etablissement";
import { sessionCourante } from "@/lib/session-serveur";
import { VueGroupes, type FiltresGroupes } from "./vue";

export const metadata: Metadata = { title: "Groupes" };

/**
 * Groupes pédagogiques — cahier des charges, ch. 07.
 *
 * Les groupes (spécialités interclasses, demi-groupes, langues) réunissent des
 * élèves choisis explicitement. Toute écriture passe par les fonctions
 * `study.etab_*` qui recalculent l'établissement en base ; la page ne protège
 * que l'affichage.
 *
 * Recherche et filtres (GR-01) en GET : l'adresse garde la recherche,
 * rechargeable et partageable.
 */
export const dynamic = "force-dynamic";

export default async function PageGroupes({ searchParams }: { searchParams: Promise<Record<string, string | undefined>> }) {
  const personne = await sessionCourante();
  if (personne === null) redirect("/connexion");

  const situation = await contexte(personne.profileId);
  if (situation === null) redirect("/admin");

  const p = await searchParams;
  const filtres: FiltresGroupes = {
    q: (p.q ?? "").slice(0, 80),
    type: p.type === "interclasses" || p.type === "sous_groupe" ? p.type : "",
    matiere: (p.matiere ?? "").slice(0, 80),
    professeur: (p.professeur ?? "").slice(0, 120),
    classe: (p.classe ?? "").slice(0, 80),
    effectif: p.effectif === "vides" || p.effectif === "avec" ? p.effectif : "",
  };

  const [liste, details] = await Promise.all([groupes(personne.profileId), groupesDetails(personne.profileId)]);
  return <VueGroupes liste={liste} details={details} filtres={filtres} />;
}
