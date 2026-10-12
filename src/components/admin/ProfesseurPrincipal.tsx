"use client";

import { useActionState, useState } from "react";
import { useFormStatus } from "react-dom";
import { CircleAlert, CircleCheck, UserRoundCheck } from "lucide-react";
import { changerProfesseurPrincipal } from "@/app/admin/actions";
import { ETAT_ADMIN_INITIAL, type EtatAdmin } from "@/app/admin/etats";

/**
 * Professeur principal d'une classe (0075). Affiché sur la carte de la classe ;
 * « Changer » ouvre un choix parmi les professeurs de l'établissement. Rien ne
 * part sans le bouton « Enregistrer ».
 */
export function ProfesseurPrincipal({
  classe,
  libelleClasse,
  actuel,
  professeurs,
}: {
  classe: string;
  libelleClasse: string;
  actuel: { id: string; nom: string } | null;
  professeurs: readonly { id: string; label: string }[];
}) {
  const [ouvert, setOuvert] = useState(false);
  const [etat, action] = useActionState<EtatAdmin, FormData>(async (precedent, donnees) => {
    try {
      const r = await changerProfesseurPrincipal(precedent, donnees);
      if (r.etat === "ok") setOuvert(false);
      return r;
    } catch {
      return { etat: "erreur", message: "La réponse du serveur n'est pas arrivée. Rechargez la page." };
    }
  }, ETAT_ADMIN_INITIAL);

  return (
    <div className="professeur-principal">
      <div className="flex items-center justify-between gap-2">
        <span className="flex min-w-0 items-center gap-2 text-[0.875rem]">
          <UserRoundCheck size={16} strokeWidth={1.75} aria-hidden="true" className="shrink-0 text-[color:var(--color-accent)]" />
          <span className="min-w-0 truncate">
            <span className="text-[color:var(--color-encre-faible)]">Professeur principal : </span>
            <span className="font-semibold">{actuel?.nom ?? "aucun"}</span>
          </span>
        </span>
        {!ouvert ? (
          <button type="button" className="shrink-0 text-[0.8125rem] font-semibold text-[color:var(--color-accent)]" onClick={() => setOuvert(true)} aria-label={`Changer le professeur principal de ${libelleClasse}`}>
            {actuel ? "Changer" : "Désigner"}
          </button>
        ) : null}
      </div>
      {ouvert ? (
        <form action={action} className="mt-2 flex flex-wrap items-center gap-2">
          <input type="hidden" name="classe" value={classe} />
          <label className="sr-only" htmlFor={`pp-${classe}`}>
            Professeur principal de {libelleClasse}
          </label>
          <select id={`pp-${classe}`} name="professeur" defaultValue={actuel?.id ?? ""} className="champ h-10 min-w-0 flex-1 py-0 text-[0.875rem]">
            <option value="">Aucun</option>
            {professeurs.map((p) => (
              <option key={p.id} value={p.id}>
                {p.label}
              </option>
            ))}
          </select>
          <button type="button" className="bouton bouton-compact bouton-discret" onClick={() => setOuvert(false)}>
            Annuler
          </button>
          <Enregistrer />
        </form>
      ) : null}
      {etat.message ? (
        <p role={etat.etat === "erreur" ? "alert" : "status"} className={`m-0 mt-1 flex items-center gap-1 text-[0.8125rem] ${etat.etat === "erreur" ? "text-[color:var(--color-erreur)]" : "text-[color:var(--color-succes)]"}`}>
          {etat.etat === "erreur" ? <CircleAlert size={14} strokeWidth={2} aria-hidden="true" /> : <CircleCheck size={14} strokeWidth={2} aria-hidden="true" />} {etat.message}
        </p>
      ) : null}
    </div>
  );
}

function Enregistrer() {
  const { pending } = useFormStatus();
  return (
    <button type="submit" className="bouton bouton-compact bouton-primaire" disabled={pending}>
      {pending ? "Enregistrement…" : "Enregistrer"}
    </button>
  );
}
