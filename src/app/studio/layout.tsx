import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Cadre } from "@/components/app/Cadre";
import { estEnseignant, sessionCourante } from "@/lib/session-serveur";

export const metadata: Metadata = {
  title: "Studio",
  robots: { index: false, follow: false },
};

/**
 * Espace du professeur — cahier V2, §8 et §9.
 *
 * Le contrôle de rôle est ici, donc pour toutes les pages de la section. Il est
 * doublé partout ailleurs : les actions du Studio agissent avec le jeton du
 * professeur, et les politiques RLS refusent ce qui ne le concerne pas. Ce
 * gabarit évite d'afficher un écran vide à quelqu'un qui n'a rien à y faire ;
 * il ne protège rien à lui seul.
 */
export const dynamic = "force-dynamic";

export const LIENS_PROFESSEUR = [
  { href: "/professeur", libelle: "Accueil" },
  { href: "/professeur/classes", libelle: "Mes classes" },
  { href: "/studio", libelle: "Studio" },
  { href: "/professeur/devoirs", libelle: "Devoirs" },
  { href: "/parametres", libelle: "Paramètres" },
] as const;

export default async function GabaritStudio({ children }: { children: React.ReactNode }) {
  const personne = await sessionCourante();
  if (personne === null) redirect("/connexion");
  if (personne.activationRequise) redirect("/activation");
  if (!estEnseignant(personne)) redirect("/app");

  return (
    <Cadre liens={LIENS_PROFESSEUR} personne={personne} contexte={personne.organisation}>
      {children}
    </Cadre>
  );
}
