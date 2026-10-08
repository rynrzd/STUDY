import { CloudOff } from "lucide-react";
import { CopiesLocales } from "@/components/study/HorsLigne";
import { EnTetePage, Encadre } from "@/components/study/ui";

export const metadata = { title: "Hors ligne" };

/**
 * A21 — Hors ligne (maquette R2 n° 2) : seulement ce qui est réellement sur
 * l'appareil. Aucune synchronisation simulée ; la liste vient du stockage
 * local borné, revalidé au retour du réseau.
 */
export default function PageHorsLigne() {
  return (
    <div className="mx-auto max-w-[880px]">
      <EnTetePage sourcil="Hors ligne" titre="Ce qui reste disponible sans réseau" sousTitre="Les séances que tu as choisi de garder sur cet appareil. Le reste demande une connexion." />
      <div className="mb-5">
        <Encadre icone={CloudOff} titre="Aucune copie n'est faite sans ton choix.">
          Sur un poste partagé, rien n&apos;est conservé. Au retour du réseau, chaque copie est revérifiée ; une séance retirée par ton professeur disparaît de l&apos;appareil.
        </Encadre>
      </div>
      <section aria-label="Copies sur cet appareil" className="panneau">
        <CopiesLocales />
      </section>
    </div>
  );
}
