"use client";

import { useActionState } from "react";
import { BoutonEnvoi, Champ, RetourFormulaire, type EtatFormulaire } from "@/components/study/formulaire";
import { demanderRecuperation } from "./actions";

export function FormulaireRecuperation() {
  const [etat, action] = useActionState<EtatFormulaire, FormData>(demanderRecuperation, {});
  if (etat.ok) {
    return <RetourFormulaire etat={etat} />;
  }
  return (
    <form action={action} noValidate>
      <RetourFormulaire etat={etat} />
      <Champ
        libelle="Code établissement"
        nom="code"
        requis
        autoComplete="organization"
        autoCapitalize="characters"
        valeur={etat.valeurs?.code}
        erreurs={etat.champs?.code}
        aide="Le code imprimé sur votre fiche d'accès."
      />
      <Champ
        libelle="Identifiant"
        nom="identifiant"
        requis
        autoComplete="username"
        autoCapitalize="none"
        valeur={etat.valeurs?.identifiant}
        erreurs={etat.champs?.identifiant}
      />
      <BoutonEnvoi enCours="Envoi…" className="w-full">
        Demander un nouvel accès
      </BoutonEnvoi>
    </form>
  );
}
