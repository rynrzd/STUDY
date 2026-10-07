import { Check } from "lucide-react";

/**
 * D02 — indicateur d'étapes de l'import de rentrée (maquette administration,
 * R2). Purement descriptif : l'étape courante vient de la page (dépôt, ou
 * vérification d'un lot). L'état est écrit en toutes lettres, pas seulement
 * porté par la couleur.
 */
const ETAPES = [
  { titre: "Importer", detail: "Fichier CSV ou Excel" },
  { titre: "Vérifier", detail: "Lignes valides, à corriger, en double" },
  { titre: "Préparer les accès", detail: "Fiches et liens d'activation" },
] as const;

export function EtapesImport({ courante }: { courante: 1 | 2 | 3 }) {
  return (
    <ol className="m-0 mt-6 grid list-none gap-3 p-0 sm:grid-cols-3" aria-label="Étapes de l'import">
      {ETAPES.map((e, i) => {
        const n = i + 1;
        const etat = n < courante ? "faite" : n === courante ? "en cours" : "à venir";
        return (
          <li
            key={e.titre}
            aria-current={n === courante ? "step" : undefined}
            className={`flex items-center gap-3 rounded-[12px] border p-3 ${n === courante ? "border-[color:var(--color-accent)] bg-[color:var(--color-rose-clair)]" : "border-[color:var(--color-bordure)] bg-[color:var(--color-surface)]"}`}
          >
            <span
              className={`grid h-9 w-9 shrink-0 place-items-center rounded-full text-[0.9375rem] font-extrabold ${n <= courante ? "bg-[color:var(--color-accent)] text-white" : "border border-[color:var(--color-bordure-forte)] text-[color:var(--color-encre-faible)]"}`}
              aria-hidden="true"
            >
              {n < courante ? <Check size={18} strokeWidth={2.25} /> : n}
            </span>
            <span className="min-w-0">
              <span className="block font-bold">{e.titre}</span>
              <span className="meta block">
                {e.detail} · <span className="font-semibold">{etat}</span>
              </span>
            </span>
          </li>
        );
      })}
    </ol>
  );
}
