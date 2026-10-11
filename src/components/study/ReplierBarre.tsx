"use client";

import { PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { useState } from "react";
import { COOKIE_BARRE } from "@/lib/preferences-affichage";

/**
 * Replie la barre latérale en rail (grand écran seulement). Préférence
 * d'affichage gardée dans un cookie, que la coque lit côté serveur : la
 * barre a la bonne largeur dès le premier rendu, sans saut.
 */
export function ReplierBarre({ repliee: initiale }: { repliee: boolean }) {
  const [repliee, setRepliee] = useState(initiale);
  return (
    <button
      type="button"
      className="replier-barre h-9 w-9 place-items-center rounded-[var(--rayon-s)] text-[color:var(--color-encre-faible)] hover:bg-[color:var(--color-survol)] hover:text-[color:var(--color-encre)]"
      aria-pressed={repliee}
      aria-label={repliee ? "Déplier la barre latérale" : "Replier la barre latérale"}
      title={repliee ? "Déplier la barre" : "Replier la barre"}
      onClick={(e) => {
        const suivant = !repliee;
        setRepliee(suivant);
        const coque = e.currentTarget.closest(".app-coque");
        if (suivant) coque?.setAttribute("data-barre", "repliee");
        else coque?.removeAttribute("data-barre");
        document.cookie = `${COOKIE_BARRE}=${suivant ? "repliee" : ""}; path=/; max-age=${suivant ? 31536000 : 0}; samesite=lax`;
      }}
    >
      {repliee ? <PanelLeftOpen size={18} strokeWidth={1.75} aria-hidden="true" /> : <PanelLeftClose size={18} strokeWidth={1.75} aria-hidden="true" />}
    </button>
  );
}
