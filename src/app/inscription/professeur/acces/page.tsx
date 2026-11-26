import Link from "next/link";
import { CadreConnexion } from "@/components/study/connexion/CadreConnexion";
import { pagePrivee } from "@/lib/metadonnees";
import { DemandeLien, UtiliserLien } from "../AccesCourriel";

export const metadata = {
  ...pagePrivee({ titre: "Accès professeur", description: "Confirmer ou récupérer son compte professeur AvecStudy." }),
  referrer: "no-referrer" as const,
};

export default async function PageAccesProfesseur({ searchParams }: {
  searchParams: Promise<{ mode?: string; token_hash?: string }>;
}) {
  const { mode: demande, token_hash: jeton } = await searchParams;
  const mode = demande === "confirmation" ? "confirmation" : "recuperation";
  return (
    <CadreConnexion titre={mode === "confirmation" ? "Confirme ton adresse e-mail." : "Récupère ton compte professeur."}>
      {typeof jeton === "string" && /^[a-zA-Z0-9_-]{20,200}$/u.test(jeton) ? <UtiliserLien mode={mode} jeton={jeton} /> : null}
      {jeton ? <p className="mt-6">Besoin d’un nouveau lien ?</p> : null}
      <DemandeLien mode={mode} />
      <div className="mt-5 grid gap-3">
        <Link href="/connexion">Revenir à la connexion</Link>
        {mode === "confirmation" ? <Link href="/inscription/professeur">Corriger l’adresse utilisée</Link> : <Link href="/acces-oublie">Compte élève ou établissement</Link>}
      </div>
    </CadreConnexion>
  );
}
