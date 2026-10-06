import { PaquetCartes } from "@/app/app/cartes/[fiche]/PaquetCartes";
import { Coque } from "@/components/study/Coque";
import { CONTEXTE_FICTIF } from "../fictif";

/** Aperçu de développement : cartes mémoire, données fictives (l'avis n'est pas enregistré). */
export default function ApercuCartes() {
  return (
    <Coque ctx={CONTEXTE_FICTIF}>
      <div className="mx-auto max-w-[720px]">
        <p className="meta m-0 mb-3">Aperçu de développement · données fictives</p>
        <h1 className="m-0 mb-5 text-[1.75rem]">Les fonctions de référence</h1>
        <PaquetCartes
          fiche="00000000-0000-4000-8000-0000000000f1"
          cartes={[
            {
              recto: "Qu'appelle-t-on l'image de 3 par une fonction f ?",
              verso: "C'est le nombre f(3) : on part de 3 sur l'axe horizontal, on monte jusqu'à la courbe, puis on lit l'ordonnée.",
              lesson: "00000000-0000-4000-8000-0000000000a1",
              ref: "bloc:b1",
            },
            { recto: "Un antécédent de 5 par f, c'est…", verso: "Tout nombre x tel que f(x) = 5. Il peut y en avoir plusieurs, ou aucun.", lesson: "00000000-0000-4000-8000-0000000000a1", ref: "bloc:b2" },
          ]}
        />
      </div>
    </Coque>
  );
}
