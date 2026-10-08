import { EnTetePage } from "@/components/study/ui";
import { ParcoursDebloque } from "@/app/app/aide/ParcoursDebloque";

/** A10 — Débloque-moi avec un exercice fictif (aperçu de développement). */
export default function ParcoursDebloqueApercu() {
  return (
    <div className="mx-auto max-w-[1000px]">
      <EnTetePage filAriane={[{ href: "/app/reviser", libelle: "Réviser" }]} sourcil="Débloque-moi" titre="Bloqué sur un exercice ?" sousTitre="Une aide graduelle, tirée de ce que ton professeur a préparé." />
      <ParcoursDebloque
        exercices={[{ versionId: "00000000-0000-4000-8000-000000000112", enonce: "Quelle est l'image de 3 par f(x) = 2x + 1 ?", seance: "00000000-0000-4000-8000-000000000242", titreSeance: "Lire une image sur un graphique" }]}
        salon={null}
      />
    </div>
  );
}
