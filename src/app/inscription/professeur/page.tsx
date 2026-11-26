import Link from "next/link";
import { CadreConnexion } from "@/components/study/connexion/CadreConnexion";
import { pagePrivee } from "@/lib/metadonnees";
import { FormulaireInscriptionProfesseur } from "./Formulaire";

export const metadata = pagePrivee({ titre: "Créer un compte professeur", description: "Créer son espace de classe AvecStudy." });

export default function Page() {
  return <CadreConnexion titre="Crée ton espace professeur." publicCible="professeur" sousTitre="Aucun lycée ni code établissement n’est demandé."><FormulaireInscriptionProfesseur /><p className="mt-5 text-center text-[0.9375rem]"><Link className="font-semibold text-[color:var(--color-accent)]" href="/connexion">J’ai déjà un compte</Link></p></CadreConnexion>;
}
