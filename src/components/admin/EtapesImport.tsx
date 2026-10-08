import { Etapes } from "@/components/study/ui";

/**
 * D02 — indicateur d'étapes de l'import de rentrée (maquette administration,
 * R2). Purement descriptif : l'étape courante vient de la page (dépôt, ou
 * vérification d'un lot).
 */
const ETAPES = [
  { titre: "Importer", detail: "Fichier CSV ou Excel" },
  { titre: "Vérifier", detail: "Valides, à corriger, en double" },
  { titre: "Préparer les accès", detail: "Fiches et liens d'activation" },
] as const;

export function EtapesImport({ courante }: { courante: 1 | 2 | 3 }) {
  return (
    <div className="mt-6 rounded-[var(--radius-carte)] border border-[color:var(--color-bordure)] bg-[color:var(--color-surface)] p-4">
      <Etapes etapes={ETAPES} courante={courante} etiquette="Étapes de l'import" />
    </div>
  );
}
