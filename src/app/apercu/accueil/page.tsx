import { AccueilEleve } from "@/components/study/accueil/AccueilEleve";
import { Coque } from "@/components/study/Coque";
import { ACCUEIL_FICTIF, CONTEXTE_FICTIF } from "../fictif";

/** Aperçu de développement : l'accueil élève avec des données fictives. */
export default function ApercuAccueil() {
  return (
    <Coque ctx={CONTEXTE_FICTIF}>
      <p className="meta m-0 mb-3">Aperçu de développement · données fictives</p>
      <AccueilEleve d={ACCUEIL_FICTIF} />
    </Coque>
  );
}
