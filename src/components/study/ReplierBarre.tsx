"use client";

import { ChevronLeft, ChevronRight } from "lucide-react";
import { useState } from "react";
import { COOKIE_BARRE } from "@/lib/preferences-affichage";

/**
 * Bouton circulaire de la barre « verre ». L'état est partagé entre le rendu
 * serveur (cookie) et l'animation immédiate côté client, sans rechargement.
 */
export function ReplierBarre({ repliee: initiale }: { repliee: boolean }) {
  const [repliee, setRepliee] = useState(initiale);
  return (
    <button
      type="button"
      className="replier-barre"
      aria-pressed={repliee}
      aria-label={repliee ? "Déplier la barre latérale" : "Replier la barre latérale"}
      title={repliee ? "Déplier la barre" : "Replier la barre"}
      onClick={(e) => {
        const suivant = !repliee;
        setRepliee(suivant);
        const coque = e.currentTarget.closest(".app-coque");
        if (suivant) coque?.setAttribute("data-barre", "repliee");
        else coque?.removeAttribute("data-barre");
        document.cookie = `${COOKIE_BARRE}=${suivant ? "repliee" : "depliee"}; path=/; max-age=31536000; samesite=lax`;
      }}
    >
      {repliee ? <ChevronRight size={17} strokeWidth={2} aria-hidden="true" /> : <ChevronLeft size={17} strokeWidth={2} aria-hidden="true" />}
    </button>
  );
}
