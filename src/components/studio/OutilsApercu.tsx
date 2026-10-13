"use client";

import Link from "next/link";
import { useRef } from "react";
import { Maximize, Presentation, Printer } from "lucide-react";

/**
 * Imprimer une séance en A4 et la projeter en classe — cahier des charges
 * ch. 10 et 11 (TEACH-18, EDIT-10). L'impression passe par le navigateur
 * (« Enregistrer en PDF » y est proposé) : ce n'est pas un export maison.
 */
export function OutilsApercu({ seance }: { seance: string }) {
  return (
    <div className="flex flex-wrap gap-2 print:hidden">
      <button type="button" className="bouton bouton-compact bouton-secondaire" onClick={() => window.print()}>
        <Printer size={16} strokeWidth={1.75} aria-hidden="true" /> Imprimer (A4)
      </button>
      <Link href={`/studio/${seance}/projection`} className="bouton bouton-compact bouton-secondaire">
        <Presentation size={16} strokeWidth={1.75} aria-hidden="true" /> Projeter
      </Link>
    </div>
  );
}

/** Cadre de projection : gros caractères, fort contraste, plein écran à la demande. */
export function CadreProjection({ retour, children }: { retour: string; children: React.ReactNode }) {
  const cadre = useRef<HTMLDivElement>(null);
  return (
    <div ref={cadre} className="projection">
      <div className="projection-barre print:hidden">
        <Link href={retour} className="lien-fleche">
          <span aria-hidden="true">←</span> Quitter la projection
        </Link>
        <button type="button" className="bouton bouton-compact bouton-secondaire" onClick={() => void cadre.current?.requestFullscreen?.().catch(() => undefined)}>
          <Maximize size={16} strokeWidth={1.75} aria-hidden="true" /> Plein écran
        </button>
      </div>
      {children}
    </div>
  );
}
