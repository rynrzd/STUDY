import type { Metadata } from "next";
import { CarteAcces } from "@/components/study/CarteAcces";
import { pagePrivee } from "@/lib/metadonnees";
import { FormulaireRecuperation } from "./FormulaireRecuperation";

export const metadata: Metadata = pagePrivee({
  titre: "Accès oublié",
  description: "Retrouver un accès perdu, auprès de son établissement.",
});

export const dynamic = "force-dynamic";

/**
 * E31 — Récupération. Un formulaire, un texte de confidentialité, la même
 * confirmation pour tout le monde. Aucune adresse personnelle n'est
 * demandée : Study n'envoie pas de courrier, l'établissement remet l'accès.
 */
export default function PageAccesOublie() {
  return (
    <CarteAcces
      titre="Accès oublié"
      sousTitre="Indiquez votre code établissement et votre identifiant. Votre demande est transmise à l'administration de votre établissement."
    >
      <FormulaireRecuperation />
      <p className="meta m-0 mt-6">
        Personne ne peut lire votre mot de passe : il n&apos;est stocké nulle part en clair. On ne peut donc pas vous le
        rappeler, seulement vous en faire choisir un nouveau. Aucune information sur l&apos;existence d&apos;un compte
        n&apos;est affichée ici.
      </p>
    </CarteAcces>
  );
}
