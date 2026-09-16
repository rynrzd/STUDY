import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Cadre } from "@/components/app/Cadre";
import { LIENS_ADMIN, LIENS_ELEVE, LIENS_PROFESSEUR } from "@/components/app/espaces";
import {
  estAdministrateur,
  estEnseignant,
  sessionCourante,
} from "@/lib/session-serveur";

export const metadata: Metadata = {
  title: "Paramètres",
  robots: { index: false, follow: false },
};

/**
 * Paramètres — cahier V2, §15.
 *
 * L'écran est le même pour tous les rôles ; seule la barre de navigation change,
 * pour que la personne revienne d'où elle vient. Un professeur qui ouvre ses
 * paramètres ne doit pas se retrouver avec les liens d'un élève.
 */
export const dynamic = "force-dynamic";

export default async function GabaritParametres({ children }: { children: React.ReactNode }) {
  const personne = await sessionCourante();
  if (personne === null) redirect("/connexion");
  if (personne.activationRequise) redirect("/activation");

  const liens = estAdministrateur(personne)
    ? LIENS_ADMIN
    : estEnseignant(personne)
      ? LIENS_PROFESSEUR
      : LIENS_ELEVE;

  return (
    <Cadre liens={liens} personne={personne} contexte={personne.organisation}>
      {children}
    </Cadre>
  );
}
