"use client";

import { useActionState } from "react";
import { BoutonEnvoi, RetourFormulaire, type EtatFormulaire } from "@/components/study/formulaire";
import { remettreLien } from "./actions";

/** Vérifier l'identité, comparer la référence, puis remettre un lien temporaire (affiché une seule fois). */
export function TraiterDemande({ demande, reference, nom }: { demande: string; reference: string | null; nom: string }) {
  const [etat, action] = useActionState<EtatFormulaire, FormData>(remettreLien.bind(null, demande), {});
  if (etat.ok && etat.message) {
    return (
      <div role="status" className="mt-3 rounded-[12px] bg-[color:var(--color-succes-fond)] p-4 text-[0.875rem]">
        <p className="m-0 font-semibold text-[color:var(--color-succes)]">Lien créé pour {nom}, valable trois jours, à usage unique.</p>
        <p className="m-0 mt-2">Remettez-le en main propre (impression ou affichage). Il ne sera plus affiché ensuite.</p>
        <p className="m-0 mt-2 break-all rounded-[8px] bg-[color:var(--color-surface)] p-2 font-mono text-[0.8125rem]" data-testid="lien-recuperation">
          {etat.message}
        </p>
      </div>
    );
  }
  return (
    <form action={action} className="mt-3 grid gap-3 rounded-[12px] border border-[color:var(--color-bordure)] p-4" noValidate>
      <RetourFormulaire etat={etat} />
      <label className="flex items-start gap-3 text-[0.875rem]">
        <input type="checkbox" name="identite" value="oui" className="mt-1 size-4 shrink-0" />
        <span>
          J&apos;ai vérifié l&apos;identité de {nom} : pièce d&apos;identité ou carte de lycéen présentée, ou personne connue de l&apos;équipe
          et présente.
        </span>
      </label>
      {reference ? (
        <div>
          <label className="etiquette" htmlFor={`ref-${demande}`}>
            Référence annoncée par la personne
          </label>
          <input id={`ref-${demande}`} name="reference" className="champ max-w-[200px] font-mono uppercase" autoComplete="off" maxLength={9} placeholder="XXXX-XXXX" />
        </div>
      ) : (
        <p className="meta m-0">Cette demande ne porte pas de référence (demande ancienne) : la vérification d&apos;identité suffit.</p>
      )}
      <BoutonEnvoi enCours="Création…" variante="primaire" className="w-fit">
        Créer un lien d&apos;accès temporaire
      </BoutonEnvoi>
    </form>
  );
}
