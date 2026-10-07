import { Coque } from "@/components/study/Coque";
import { EnTetePage, EtatVide, Panneau } from "@/components/study/ui";
import { ClipboardList } from "lucide-react";
import { CONTEXTE_FICTIF } from "../fictif";

/**
 * Aperçu de développement : la coque R2 des trois espaces (élève, professeur,
 * administration) et le sélecteur d'espace d'un compte à plusieurs
 * capacités. Données fictives ; jamais servi en production (layout).
 *   /apercu/espaces?espace=professeur|admin|eleve
 */
export default async function ApercuEspaces({ searchParams }: { searchParams: Promise<{ espace?: string }> }) {
  const { espace = "eleve" } = await searchParams;
  const chemin = espace === "admin" ? "/admin" : espace === "professeur" ? "/professeur" : "/app";
  const ctx = {
    ...CONTEXTE_FICTIF,
    chemin,
    personne: { ...CONTEXTE_FICTIF.personne, prenom: "Claire", nom: "Exemple", roles: ["eleve", "professeur", "admin_etablissement"] as typeof CONTEXTE_FICTIF.personne.roles },
    roles: { eleve: true, professeur: true, admin: true, exploitant: false },
  };
  const titre = espace === "admin" ? "Vue d'ensemble" : espace === "professeur" ? "Accueil professeur" : "Accueil";
  return (
    <Coque ctx={ctx}>
      <p className="meta m-0 mb-3">Aperçu de développement · coque {espace} · données fictives</p>
      <EnTetePage titre={titre} sousTitre="Lycée fictif" />
      <div className="grid gap-5 lg:grid-cols-2">
        <Panneau titre="Bloc de contenu">
          <p className="m-0 text-[color:var(--color-encre-faible)]">Le contenu réel de cet écran provient des services sous la session de la personne.</p>
        </Panneau>
        <EtatVide icone={ClipboardList} titre="État vide" texte="Chaque écran de données a un état vide qui explique et propose une action utile." />
      </div>
    </Coque>
  );
}
