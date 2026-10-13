"use client";

import { useEffect } from "react";
import { creerSignalementActivite } from "@/lib/signalement-activite";

/** Aucun timer ni ping de fond : seuls les gestes visibles maintiennent la session. */
export function ActiviteSession() {
  useEffect(() => {
    const signaler = creerSignalementActivite({
      visible: () => document.visibilityState === "visible",
      envoyer: () => fetch("/api/v1/session/activite", { method: "POST", credentials: "same-origin" }),
    });
    const evenements = ["pointerdown", "keydown", "scroll", "input"];
    for (const nom of evenements) window.addEventListener(nom, signaler, { passive: true, capture: true });
    return () => { for (const nom of evenements) window.removeEventListener(nom, signaler, true); };
  }, []);
  return null;
}
