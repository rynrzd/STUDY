"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState } from "react";

/**
 * Relit la page serveur tant qu'un travail est en cours (E40). Aucune
 * progression n'est simulée : on affiche l'état réel à chaque relecture. Au
 * bout de huit secondes, on le dit (« cela prend un peu plus de temps »).
 */
export function Actualisation({ actif, intervalleMs = 3000 }: { actif: boolean; intervalleMs?: number }) {
  const router = useRouter();
  const [long, setLong] = useState(false);
  useEffect(() => {
    if (!actif) return;
    const t = window.setInterval(() => router.refresh(), intervalleMs);
    const l = window.setTimeout(() => setLong(true), 8000);
    return () => {
      window.clearInterval(t);
      window.clearTimeout(l);
    };
  }, [actif, intervalleMs, router]);
  if (!actif || !long) return null;
  return (
    <p role="status" className="meta m-0 mt-3">
      Cela prend un peu plus de temps. Tu peux quitter cette page : la fiche t&apos;attendra dans « Mes fiches », et une notification te
      préviendra.
    </p>
  );
}

export function BoutonImprimer({ libelle = "Imprimer" }: { libelle?: string }) {
  return (
    <button type="button" className="bouton bouton-secondaire" onClick={() => window.print()}>
      {libelle}
    </button>
  );
}
