import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ConteneurEffets } from "@/components/study/ConteneurEffets";
import { Coque } from "@/components/study/Coque";
import { IntroConnexion } from "@/components/study/IntroConnexion";
import { publierSeancesEchues } from "@/lib/publication";
import { contexteApp } from "@/lib/v6/contexte";

export const metadata: Metadata = {
  title: { default: "Study", template: "%s — Study" },
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

/**
 * L'application connectée — dossier Study V6, §2.
 *
 * La session et les affectations sont relues à chaque requête. Un élève sans
 * aucune classe active n'entre pas : il est conduit à « Accès en attente »,
 * qui ne montre ni cours ni membre (E34). Le compte exploitant a son propre
 * espace et n'entre pas ici.
 */
export default async function GabaritApp({ children }: { children: React.ReactNode }) {
  // Les séances programmées dont l'heure est venue passent en « publiée »
  // avant toute lecture : un élève voit son cours à l'heure dite, sans
  // attendre la tâche de nuit (cahier des charges ch. 14).
  const [ctx] = await Promise.all([contexteApp(), publierSeancesEchues().catch(() => null)]);
  if (ctx.roles.exploitant) redirect("/administration");

  const seulementEleve = ctx.roles.eleve && !ctx.roles.professeur && !ctx.roles.admin;
  if (seulementEleve && ctx.contextes.length === 0) redirect("/acces-en-attente");

  return (
    <ConteneurEffets>
      <IntroConnexion />
      <Coque ctx={ctx}>{children}</Coque>
    </ConteneurEffets>
  );
}
