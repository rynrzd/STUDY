import { Entrainement } from "@/app/app/entrainements/[session]/Entrainement";
import { Coque } from "@/components/study/Coque";
import { CONTEXTE_FICTIF } from "../fictif";

/** Aperçu de développement : entraînement, données fictives (rien n'est enregistré). */
export default function ApercuEntrainement() {
  return (
    <Coque ctx={CONTEXTE_FICTIF}>
      <div className="mx-auto max-w-[760px]">
        <p className="meta m-0 mb-3">Aperçu de développement · données fictives</p>
        <Entrainement
          session="00000000-0000-4000-8000-0000000000b1"
          questions={[
            {
              versionId: "00000000-0000-4000-8000-0000000000b2",
              ordre: 1,
              kind: "qcm",
              enonce: "Sur le graphique, quelle est l'image de 2 par f ?",
              choix: ["f(2) = 1", "f(2) = 3", "f(2) = -1"],
              notion: "Image d'un nombre",
              tentativeId: null,
              correct: null,
              reponse: null,
            },
          ]}
        />
      </div>
    </Coque>
  );
}
