"use client";

import { useActionState } from "react";
import { BoutonEnvoi, Champ, RetourFormulaire, type EtatFormulaire } from "@/components/study/formulaire";
import { utiliserInvitation } from "./actions";

export function FormulaireInvitation({ jeton }: { jeton: string }) {
  const [etat, action] = useActionState<EtatFormulaire, FormData>(utiliserInvitation.bind(null, jeton), {});
  return (
    <form action={action} noValidate>
      <RetourFormulaire etat={etat} />
      <Champ
        libelle="Nouveau mot de passe"
        nom="nouveau"
        type="password"
        requis
        autoComplete="new-password"
        minLength={12}
        erreurs={etat.champs?.nouveau}
        aide="Douze caractères au moins. Une phrase facile à retenir fonctionne bien."
      />
      <Champ libelle="Confirmation" nom="confirmation" type="password" requis autoComplete="new-password" />
      <BoutonEnvoi enCours="Enregistrement…" className="w-full">
        Enregistrer mon mot de passe
      </BoutonEnvoi>
    </form>
  );
}
