"use client";

import { Printer } from "lucide-react";

export function BoutonImprimer() {
  return (
    <button type="button" className="bouton bouton-primaire" onClick={() => window.print()}>
      <Printer size={16} aria-hidden="true" /> Imprimer
    </button>
  );
}
