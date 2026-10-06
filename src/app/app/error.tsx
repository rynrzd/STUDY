"use client";

import Link from "next/link";
import { useEffect } from "react";

/**
 * Erreur dans l'application : explication honnête, identifiant opaque pour
 * l'assistance, nouvelle tentative contrôlée. Aucune pile, aucun détail SQL.
 */
export default function ErreurApp({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(JSON.stringify({ niveau: "erreur", contexte: "app.rendu", digest: error.digest ?? null }));
  }, [error]);
  return (
    <div role="alert" className="panneau mx-auto max-w-[560px] text-center">
      <p className="titre-section m-0">Cette page n&apos;a pas pu s&apos;afficher.</p>
      <p className="m-0 mt-2 text-[color:var(--color-encre-faible)]">
        Rien de ce que tu avais enregistré n&apos;est perdu. Réessaie dans un instant ; si le problème continue, donne cette référence à
        l&apos;assistance.
      </p>
      {error.digest ? <p className="meta m-0 mt-2">Référence : {error.digest.slice(0, 12)}</p> : null}
      <div className="mt-5 flex justify-center gap-2">
        <button type="button" className="bouton bouton-primaire" onClick={() => reset()}>
          Réessayer
        </button>
        <Link href="/app" className="bouton bouton-secondaire">
          Mon espace
        </Link>
      </div>
    </div>
  );
}
