import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Cadre } from "@/components/app/Cadre";
import { LIENS_ADMIN } from "@/components/app/espaces";
import { sessionCourante } from "@/lib/session-serveur";

export const metadata: Metadata = {
  title: { default: "Administration", template: "%s — AvecStudy" },
  robots: { index: false, follow: false },
};

/**
 * Administration d'un établissement — cahier V2, §14.
 *
 * Réservé au rôle `admin_etablissement`. Comme pour l'exploitation, le contrôle
 * est doublé en base : les fonctions `study.etab_*` recalculent l'établissement
 * à partir de l'adhésion de l'appelant et refusent tout le reste. Ce gabarit
 * évite d'afficher un écran vide ; il ne protège pas les données à lui seul.
 */
export const dynamic = "force-dynamic";

export default async function GabaritAdmin({ children }: { children: React.ReactNode }) {
  const personne = await sessionCourante();
  if (personne === null) redirect("/connexion");
  if (personne.activationRequise) redirect("/activation");
  if (!personne.roles.includes("admin_etablissement")) redirect("/app");

  return (
    <Cadre
      liens={LIENS_ADMIN}
      personne={personne}
      contexte={personne.organisation ?? "Établissement"}
    >
      {children}
    </Cadre>
  );
}
