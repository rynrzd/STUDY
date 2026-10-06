import { CopiesLocales } from "@/components/study/HorsLigne";
import { EnTetePage, Panneau } from "@/components/study/ui";

export const metadata = { title: "Hors ligne" };

/** Les copies choisies, lisibles sans réseau. Rien d'autre n'est conservé sur l'appareil. */
export default function PageHorsLigne() {
  return (
    <div className="mx-auto max-w-[820px]">
      <EnTetePage titre="Mes copies hors ligne" sousTitre="Les séances que tu as choisi de garder sur cet appareil." />
      <Panneau>
        <CopiesLocales />
      </Panneau>
    </div>
  );
}
