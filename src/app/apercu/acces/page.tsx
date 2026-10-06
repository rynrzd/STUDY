import { CadreConnexion } from "@/components/study/connexion/CadreConnexion";
import { FormulaireRecuperation } from "@/app/acces-oublie/FormulaireRecuperation";
import { VueInvitation } from "@/app/invitation/[jeton]/VueInvitation";

/**
 * Aperçu de développement des écrans d'accès qui dépendent de la base :
 * états d'invitation et accusé de récupération. Données fictives ; aucune
 * action n'aboutit ici (pas de base).
 */
const JETON = "A".repeat(43);

export default async function ApercuAcces({ searchParams }: { searchParams: Promise<{ vue?: string }> }) {
  const { vue = "invitation-valide" } = await searchParams;
  if (vue === "recuperation-envoyee") {
    return (
      <CadreConnexion titre="Mot de passe oublié ?" sousTitre="Ton établissement te remettra un nouvel accès, après avoir vérifié ton identité.">
        <FormulaireRecuperation etablissement="Lycée de démonstration" etatInitial={{ etat: "envoyee", reference: "K7M2-P9QX", etablissement: "Lycée de démonstration" }} />
      </CadreConnexion>
    );
  }
  const etat = vue.replace("invitation-", "");
  const commun = { prenom: "Camille", organisation: "Lycée de démonstration", code_etablissement: "LYC-4821", identifiant: "camille.martin" };
  return (
    <VueInvitation
      jeton={JETON}
      etat={
        etat === "valide" || etat === "actif"
          ? { etat: "valide", ...commun, compte: etat === "actif" ? "actif" : "a_activer" }
          : { etat, prenom: null, organisation: null, code_etablissement: null, identifiant: null, compte: null }
      }
    />
  );
}
