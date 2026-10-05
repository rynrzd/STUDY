"use client";

import { useEffect, useId, useRef, useState } from "react";

/**
 * Dialogue de confirmation — dossier Study V6, §3.4.
 *
 * Élément <dialog> natif : le focus y est piégé par le navigateur, Échap le
 * ferme (sauf opération critique), et le focus revient au déclencheur. La
 * confirmation nomme l'objet et son impact ; l'action réelle est un
 * formulaire, donc elle fonctionne aussi sans attendre le JavaScript.
 */
export function Confirmer({
  declencheur,
  titre,
  impact,
  children,
  critique = false,
  variante = "secondaire",
}: {
  declencheur: React.ReactNode;
  titre: string;
  impact: React.ReactNode;
  /** Le formulaire qui exécute réellement l'action. */
  children: React.ReactNode;
  critique?: boolean;
  variante?: "secondaire" | "danger" | "primaire" | "discret";
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const bouton = useRef<HTMLButtonElement>(null);
  const [ouvert, setOuvert] = useState(false);
  const idTitre = useId();

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (ouvert && !d.open) d.showModal();
    if (!ouvert && d.open) d.close();
  }, [ouvert]);

  return (
    <>
      <button ref={bouton} type="button" className={`bouton bouton-${variante}`} onClick={() => setOuvert(true)}>
        {declencheur}
      </button>
      <dialog
        ref={ref}
        className="dialogue"
        aria-labelledby={idTitre}
        onCancel={(e) => {
          if (critique) e.preventDefault();
          else setOuvert(false);
        }}
        onClose={() => {
          setOuvert(false);
          bouton.current?.focus();
        }}
      >
        <h2 id={idTitre} className="titre-section">
          {titre}
        </h2>
        <div className="mt-3 text-[color:var(--color-encre-faible)]">{impact}</div>
        <div className="mt-6 flex flex-wrap justify-end gap-2">
          <button type="button" className="bouton bouton-secondaire" onClick={() => setOuvert(false)}>
            Annuler
          </button>
          {children}
        </div>
      </dialog>
    </>
  );
}
