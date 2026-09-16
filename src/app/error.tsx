"use client";

import Link from "next/link";
import { useEffect } from "react";

/**
 * Page d'erreur serveur (500).
 *
 * Elle ne montre ni pile d'appel, ni message technique, ni identifiant de
 * requête interne : ces éléments renseignent un attaquant sur la structure de
 * l'application (ch. 22). Le `digest` que Next attache à l'erreur est en
 * revanche utile au support — c'est une valeur opaque, sans contenu — et il
 * n'est affiché que s'il existe.
 */
export default function Erreur({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // La trace complète reste côté serveur ; ici, on note seulement qu'une
    // erreur a été rendue, sans recopier le message dans la console publique.
    console.error("Erreur de rendu", error.digest ?? "sans référence");
  }, [error]);

  return (
    <main id="contenu" className="sans-debordement">
      <div className="contenu flex min-h-screen max-w-[46rem] flex-col justify-center py-20">
        <p className="surtitre m-0">Erreur</p>
        <h1 className="mt-4 text-[length:var(--text-h1-mobile)] leading-[var(--text-h1-mobile--line-height)] md:text-[3.25rem] md:leading-[3.5rem]">
          Le service n&apos;a pas pu répondre.
        </h1>
        <p className="mt-6 max-w-[58ch] text-[length:var(--text-grand)] leading-[var(--text-grand--line-height)] text-[color:var(--color-encre-faible)]">
          Rien de ce que vous avez saisi n&apos;a été perdu si la page était déjà
          enregistrée. Réessayez ; si l&apos;erreur revient, signalez-la avec la
          référence ci-dessous.
        </p>

        {error.digest ? (
          <p className="mt-4 text-[length:var(--text-aide)] text-[color:var(--color-encre-faible)]">
            Référence : <code className="font-mono">{error.digest}</code>
          </p>
        ) : null}

        <div className="mt-9 flex flex-wrap gap-3">
          <button type="button" onClick={reset} className="bouton bouton-primaire">
            Réessayer
          </button>
          <Link href="/" className="bouton bouton-secondaire">
            Retour à l&apos;accueil
          </Link>
          <Link href="/contact" className="bouton bouton-discret">
            Signaler le problème
          </Link>
        </div>
      </div>
    </main>
  );
}
