import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Cadre } from "@/components/app/Cadre";
import { LIENS_PROFESSEUR } from "@/components/app/espaces";
import { estEnseignant, sessionCourante } from "@/lib/session-serveur";

export const metadata: Metadata = {
  title: { default: "Espace professeur", template: "%s — AvecStudy" },
  robots: { index: false, follow: false },
};

/**
 * Espace professeur — cahier V2, §8.
 *
 * Le contrôle de rôle est fait ici pour toute la section. Il évite d'ouvrir un
 * écran vide à quelqu'un qui n'a rien à y faire ; il ne protège pas les données
 * à lui seul : chaque lecture passe ensuite par le jeton de la personne, et
 * c'est RLS qui décide.
 */
export const dynamic = "force-dynamic";

export default async function GabaritProfesseur({ children }: { children: React.ReactNode }) {
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
