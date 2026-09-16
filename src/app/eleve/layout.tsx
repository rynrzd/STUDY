import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Cadre } from "@/components/app/Cadre";
import { LIENS_ELEVE } from "@/components/app/espaces";
import { estEleve, sessionCourante } from "@/lib/session-serveur";

export const metadata: Metadata = {
  title: { default: "Mon espace", template: "%s — AvecStudy" },
  robots: { index: false, follow: false },
};

/**
 * Espace élève — cahier V2, §7.
 *
 * Le rôle est vérifié ici pour toute la section, et chaque lecture repasse
 * derrière par le jeton de l'élève : une adresse devinée ne donne pas accès à
 * la séance d'une autre classe, elle donne une page 404.
 */
export const dynamic = "force-dynamic";

export default async function GabaritEleve({ children }: { children: React.ReactNode }) {
  const personne = await sessionCourante();
  if (personne === null) redirect("/connexion");
  if (personne.activationRequise) redirect("/activation");
  if (!estEleve(personne)) redirect("/app");

  return (
    <Cadre liens={LIENS_ELEVE} personne={personne} contexte={personne.organisation}>
      {children}
    </Cadre>
  );
}
