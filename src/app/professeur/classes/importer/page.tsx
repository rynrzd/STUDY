import { redirect } from "next/navigation";
import { TitreEspace } from "@/components/app/Cadre";
import { pagePrivee } from "@/lib/metadonnees";
import { sessionCourante } from "@/lib/session-serveur";
import { FormulaireImportClasse } from "./Formulaire";

export const metadata = pagePrivee({ titre: "Ajouter des élèves", description: "Vérifier une liste puis préparer les comptes élèves." });

export default async function Page({ searchParams }: { searchParams: Promise<{ classe?: string }> }) {
  const personne = await sessionCourante();
  if (!personne || !personne.roles.includes("professeur")) redirect("/connexion");
  const { classe = "" } = await searchParams;
  if (!/^[0-9a-f-]{36}$/i.test(classe)) redirect("/professeur/classes");
  return <><TitreEspace titre="Ajouter des élèves" sousTitre="Aucun compte n’est créé avant ta confirmation." /><div className="mt-8"><FormulaireImportClasse classe={classe} /></div></>;
}
