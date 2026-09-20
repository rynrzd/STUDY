"use client";

import { useActionState, useOptimistic } from "react";
import { marquerFait } from "@/app/eleve/actions";
import { ETAT_ELEVE_INITIAL, type EtatEleve } from "@/app/eleve/etats";

/**
 * « Fait » — cahier V5, §3.3.
 *
 * Une case à cocher, et rien autour : pas de score, pas de série de jours, pas
 * de félicitations. L'état est personnel et persistant — le professeur ne le
 * voit pas, et la politique `travaux_faits_eleve` le garantit en base.
 *
 * L'affichage suit le clic tout de suite, avant la réponse du serveur. Une
 * case qui attend un aller-retour donne l'impression de ne pas avoir compris,
 * et l'élève clique une deuxième fois.
 */
export function CaseFaite({
  devoir,
  fait,
  libelle,
}: {
  devoir: string;
  fait: boolean;
  libelle: string;
}) {
  const [etat, envoyer] = useActionState<EtatEleve, FormData>(marquerFait, ETAT_ELEVE_INITIAL);
  const [coche, cocher] = useOptimistic(fait);

  return (
    <form
      action={(donnees) => {
        cocher(donnees.get("fait") === "oui");
        return envoyer(donnees);
      }}
      className="shrink-0"
    >
      <input type="hidden" name="devoir" value={devoir} />
      <input type="hidden" name="fait" value={coche ? "non" : "oui"} />

      <button
        type="submit"
        data-testid="case-fait"
        data-devoir={devoir}
        data-fait={coche ? "oui" : "non"}
        aria-pressed={coche}
        className={`flex min-h-[var(--spacing-cible)] items-center gap-2 rounded-[var(--radius-champ)] border px-3 py-2 text-[length:var(--text-aide)] transition-colors ${
          coche
            ? "border-[color:var(--color-succes)] bg-[color:var(--color-succes-fond)] text-[color:var(--color-succes)]"
            : "border-[color:var(--color-bordure)] text-[color:var(--color-encre-faible)] hover:border-[color:var(--color-encre-faible)]"
        }`}
      >
        <span
          aria-hidden="true"
          className={`grid h-4 w-4 place-items-center rounded-[4px] border ${
            coche
              ? "border-[color:var(--color-succes)] bg-[color:var(--color-succes)] text-white"
              : "border-[color:var(--color-bordure)]"
          }`}
        >
          {coche ? "✓" : ""}
        </span>
        <span className="sr-only">
          {coche ? "Marquer comme à faire :" : "Marquer comme fait :"} {libelle}
        </span>
        <span aria-hidden="true">{coche ? "Fait" : "À faire"}</span>
      </button>

      {etat.etat === "erreur" ? (
        <span role="alert" className="sr-only">
          {etat.message}
        </span>
      ) : null}
    </form>
  );
}
