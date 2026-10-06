"use client";

import { WifiOff } from "lucide-react";
import { useSyncExternalStore } from "react";

/**
 * Hors ligne — dossier Study V6, §4 : un bandeau discret, sans bloquer la
 * lecture de ce qui est déjà affiché. Les envois en cours gardent leur texte
 * et leur statut ; rien n'est présenté comme envoyé avant l'accusé serveur.
 */
function abonner(rappel: () => void) {
  window.addEventListener("online", rappel);
  window.addEventListener("offline", rappel);
  return () => {
    window.removeEventListener("online", rappel);
    window.removeEventListener("offline", rappel);
  };
}

export function BandeauReseau({ copies = false }: { copies?: boolean }) {
  const enLigne = useSyncExternalStore(
    abonner,
    () => navigator.onLine,
    () => true,
  );
  if (enLigne) return null;
  return (
    <div
      role="status"
      className="app-sans-impression flex items-center gap-2 bg-[color:var(--color-attention-fond)] px-4 py-2 text-[0.8125rem] font-medium text-[color:var(--color-attention)]"
    >
      <WifiOff size={16} strokeWidth={1.75} aria-hidden="true" />
      Connexion perdue. Ce qui est affiché reste lisible ; vos envois reprendront au retour du réseau, sans doublon.
      {copies ? (
        <a href="/app/hors-ligne" className="ml-1 font-semibold text-[color:var(--color-attention)]">
          Mes copies hors ligne
        </a>
      ) : null}
    </div>
  );
}
