"use client";

import { useEffect } from "react";
import { erreurTailleDepot } from "@/lib/limites-depot";

/** Intercepte aussi les requestSubmit et les boutons avec formAction, avant React. */
export function GardeDepots() {
  useEffect(() => {
    function verifier(e: SubmitEvent) {
      const form = e.target;
      if (!(form instanceof HTMLFormElement) || !form.querySelector('input[type="file"]')) return;
      form.querySelector('[data-erreur-depot]')?.remove();
      const message = erreurTailleDepot(new FormData(form));
      if (message === null) return;
      e.preventDefault();
      e.stopImmediatePropagation();
      const alerte = document.createElement("p");
      alerte.dataset.erreurDepot = "true";
      alerte.setAttribute("role", "alert");
      alerte.tabIndex = -1;
      alerte.className = "mt-3 text-[color:var(--color-erreur)]";
      alerte.textContent = message;
      form.append(alerte);
      alerte.focus();
    }
    document.addEventListener("submit", verifier, true);
    return () => document.removeEventListener("submit", verifier, true);
  }, []);
  return null;
}
