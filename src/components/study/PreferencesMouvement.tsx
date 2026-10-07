"use client";

import { useState } from "react";
import type { PreferenceEffets } from "@/lib/mouvement";
import { enregistrerPreference, usePreference } from "./mouvement";

const CHOIX: readonly { valeur: PreferenceEffets; libelle: string; aide: string }[] = [
  { valeur: "auto", libelle: "Automatique", aide: "Suit le réglage « réduire les animations » de ton appareil." },
  { valeur: "reduits", libelle: "Réduits", aide: "Ni déplacement ni fondu : les changements sont immédiats." },
  { valeur: "desactives", libelle: "Désactivés", aide: "Aucune animation, y compris les transitions de couleur." },
];

/**
 * Réglage « Effets visuels » (brief §8). Enregistré sur cet appareil
 * (cookie), appliqué immédiatement, sans rechargement. Aucune fonction ne
 * dépend de ce choix : seuls les mouvements changent.
 */
export function PreferencesMouvement() {
  const actuelle = usePreference();
  const [confirme, setConfirme] = useState(false);
  return (
    <fieldset className="m-0 border-0 p-0">
      <legend className="mb-3 text-[0.875rem] text-[color:var(--color-encre-faible)]">Ce choix vaut pour cet appareil.</legend>
      <div className="grid gap-2">
        {CHOIX.map((c) => (
          <label
            key={c.valeur}
            className={`flex cursor-pointer items-start gap-3 rounded-[12px] border px-4 py-3 ${
              actuelle === c.valeur ? "border-[color:var(--color-accent)] bg-[color:var(--color-rose-clair)]" : "border-[color:var(--color-bordure)]"
            }`}
          >
            <input
              type="radio"
              name="effets"
              value={c.valeur}
              checked={actuelle === c.valeur}
              onChange={() => {
                enregistrerPreference(c.valeur);
                setConfirme(true);
              }}
              className="mt-1"
            />
            <span>
              <span className="block font-semibold">{c.libelle}</span>
              <span className="meta block">{c.aide}</span>
            </span>
          </label>
        ))}
      </div>
      <p role="status" className="meta m-0 mt-2 min-h-[1.25rem]">
        {confirme ? "Réglage enregistré sur cet appareil." : ""}
      </p>
    </fieldset>
  );
}
