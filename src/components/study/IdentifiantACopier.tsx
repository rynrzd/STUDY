"use client";

import { useState } from "react";

export function IdentifiantACopier({ identifiant }: { identifiant: string }) {
  const [message, setMessage] = useState("");
  return (
    <div className="my-4 rounded border border-[color:var(--color-bordure)] p-3">
      <p className="m-0">Ton identifiant <strong className="break-all font-mono">{identifiant}</strong></p>
      <button type="button" className="bouton bouton-secondaire bouton-compact mt-2" onClick={async () => {
        try {
          await navigator.clipboard.writeText(identifiant);
          setMessage("Identifiant copié.");
        } catch {
          setMessage("Tu peux sélectionner et copier l’identifiant affiché.");
        }
      }}>Copier mon identifiant</button>
      <p className="meta m-0" role="status">{message}</p>
    </div>
  );
}
