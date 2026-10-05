"use client";

import Link from "next/link";
import { useActionState } from "react";
import { BoutonEnvoi, Champ, RetourFormulaire, type EtatFormulaire } from "@/components/study/formulaire";
import { rejoindre } from "./actions";

export function FormulaireRejoindre({ codeInitial }: { codeInitial?: string }) {
  const [etat, action] = useActionState<EtatFormulaire, FormData>(rejoindre, {});
  return (
    <form action={action} noValidate>
      <RetourFormulaire etat={etat} />
      {etat.ok ? (
        <Link href="/app" className="bouton bouton-primaire w-full">
          Ouvrir mon espace
        </Link>
      ) : (
        <>
          <Champ
            libelle="Code de classe"
            nom="code"
            requis
            autoComplete="off"
            autoCapitalize="characters"
            spellCheck={false}
            maxLength={14}
            valeur={etat.valeurs?.code ?? codeInitial}
            erreurs={etat.champs?.code?.filter(Boolean)}
            aide="10 lettres ou chiffres, donnés par votre professeur principal ou la vie scolaire."
            className="champ font-mono uppercase tracking-[0.2em]"
          />
          <BoutonEnvoi enCours="Vérification…" className="w-full">
            Envoyer ma demande
          </BoutonEnvoi>
        </>
      )}
    </form>
  );
}
