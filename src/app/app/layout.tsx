import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { Coque } from "@/components/study/Coque";
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
  const ctx = await contexteApp();
  if (ctx.roles.exploitant) redirect("/administration");

  const seulementEleve = ctx.roles.eleve && !ctx.roles.professeur && !ctx.roles.admin;
  if (seulementEleve && ctx.contextes.length === 0) redirect("/acces-en-attente");

  return <Coque ctx={ctx}>{children}</Coque>;
}
