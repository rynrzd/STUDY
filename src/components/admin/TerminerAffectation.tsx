"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { CircleAlert, CircleCheck } from "lucide-react";
import { terminerUneAffectation } from "@/app/admin/actions";
import { ETAT_ADMIN_INITIAL, type EtatAdmin } from "@/app/admin/etats";

/**
 * Terminer une affectation, et elle seule — cahier des charges ch. 08.
 * Deux temps : le bouton ouvre un choix de date et une confirmation qui nomme
 * le cours ; rien ne part au premier clic.
 */
export function TerminerAffectation({ affectation, libelle }: { affectation: string; libelle: string }) {
  const [ouvert, setOuvert] = useState(false);
  const [etat, action] = useActionState<EtatAdmin, FormData>(async (precedent, donnees) => {
    try {
      return await terminerUneAffectation(precedent, donnees);
    } catch {
      return { etat: "erreur", message: "La réponse du serveur n'est pas arrivée. Rechargez la page." };
    }
  }, ETAT_ADMIN_INITIAL);

  if (etat.etat === "ok") {
    return (
      <span className="flex items-center gap-1 text-[0.8125rem] text-[color:var(--color-succes)]" role="status">
        <CircleCheck size={14} strokeWidth={2} aria-hidden="true" /> {etat.message}
      </span>
    );
  }

  if (!ouvert) {
    return (
      <button type="button" className="text-[0.8125rem] font-semibold text-[color:var(--color-encre-faible)] hover:text-[color:var(--color-erreur)]" onClick={() => setOuvert(true)} aria-label={`Terminer l'affectation ${libelle}`}>
        Terminer
      </button>
    );
  }

  return (
    <form action={action} className="terminer-affectation">
      <input type="hidden" name="affectation" value={affectation} />
      <span className="text-[0.8125rem] font-semibold">Terminer « {libelle} »</span>
      <label className="flex items-center gap-2 text-[0.8125rem]">
        Dernier jour
        <input name="date" type="date" className="champ h-9 py-0 text-[0.8125rem]" aria-label="Dernier jour (vide : aujourd'hui)" />
      </label>
      <span className="flex gap-2">
        <button type="button" className="bouton bouton-compact bouton-discret" onClick={() => setOuvert(false)}>
          Annuler
        </button>
        <Confirmer />
      </span>
      {etat.etat === "erreur" ? (
        <span className="flex items-center gap-1 text-[0.8125rem] text-[color:var(--color-erreur)]" role="alert">
          <CircleAlert size={14} strokeWidth={2} aria-hidden="true" /> {etat.message}
        </span>
      ) : null}
    </form>
  );
}

function Confirmer() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" disabled={pending} className="bouton bouton-compact bouton-primaire">
      {pending ? "…" : "Confirmer"}
    </button>
  );
}
