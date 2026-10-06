import { CocheFin } from "@/components/study/CocheFin";
import { Coque } from "@/components/study/Coque";
import { CONTEXTE_FICTIF } from "../fictif";

/** Aperçu de développement : la fin d'un entraînement (bilan fictif). */
export default function ApercuFin() {
  return (
    <Coque ctx={CONTEXTE_FICTIF}>
      <div className="mx-auto max-w-[760px]">
        <p className="meta m-0 mb-3">Aperçu de développement · données fictives</p>
        <div className="panneau text-center">
          <CocheFin />
          <p className="titre-section m-0 mt-3">Entraînement terminé</p>
          <p className="m-0 mt-2 text-[color:var(--color-encre-faible)]">
            4 réussites sur 5 questions corrigées. Ce n&apos;est pas une note : tes erreurs sont rangées dans ton carnet, pour y revenir.
          </p>
        </div>
      </div>
    </Coque>
  );
}
