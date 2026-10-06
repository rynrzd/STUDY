import { Coque } from "@/components/study/Coque";
import { PreferencesMouvement } from "@/components/study/PreferencesMouvement";
import { Panneau } from "@/components/study/ui";
import { CONTEXTE_FICTIF } from "../fictif";

/** Aperçu de développement : le réglage « Effets visuels ». */
export default function ApercuReglages() {
  return (
    <Coque ctx={CONTEXTE_FICTIF}>
      <div className="mx-auto max-w-[760px]">
        <p className="meta m-0 mb-3">Aperçu de développement · données fictives</p>
        <Panneau id="effets" titre="Effets visuels">
          <PreferencesMouvement />
        </Panneau>
      </div>
    </Coque>
  );
}
