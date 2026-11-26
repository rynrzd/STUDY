import type { Metadata } from "next";
import Link from "next/link";
import { redirect } from "next/navigation";
import { seancesDuProfesseur } from "@/lib/espace-professeur";
import { jetonAccesDe, sessionCourante } from "@/lib/session-serveur";
import { coursDuProfesseur } from "@/lib/studio";
import { GuideDemarrage } from "../GuideDemarrage";

export const metadata: Metadata = { title: "Bien démarrer" };

export default async function PageDemarrage() {
  const personne = await sessionCourante();
  if (!personne) redirect("/connexion");
  const jeton = await jetonAccesDe(personne);
  if (!jeton) redirect("/connexion");
  const [cours, seances] = await Promise.all([coursDuProfesseur(jeton), seancesDuProfesseur(jeton)]);
  return (
    <>
      <GuideDemarrage
        prenom={personne.prenom}
        coursCrees={cours.length}
        seancesCreees={seances.length}
        seancesPubliees={seances.filter((seance) => seance.state === "publiee").length}
      />
      <div className="mt-6 flex flex-wrap gap-4 text-sm">
        <Link href="/professeur">← Retour à mon accueil</Link>
        <Link href="/rejoindre">Je rejoins plutôt une classe existante</Link>
      </div>
    </>
  );
}
