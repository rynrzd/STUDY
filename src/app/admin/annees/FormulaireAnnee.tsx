"use client";

import { useActionState } from "react";
import { BoutonEnvoi, Champ, RetourFormulaire, type EtatFormulaire } from "@/components/study/formulaire";
import { preparerAnnee } from "./actions";

export function FormulaireAnnee({ suggestion }: { suggestion: { label: string; debut: string; fin: string } }) {
  const [etat, action] = useActionState<EtatFormulaire, FormData>(preparerAnnee, {});
  return (
    <form action={action} noValidate className="grid gap-4 sm:grid-cols-3">
      <div className="sm:col-span-3">
        <RetourFormulaire etat={etat} />
      </div>
      <Champ libelle="Année" nom="label" requis valeur={etat.valeurs?.label ?? suggestion.label} erreurs={etat.champs?.label} />
      <Champ libelle="Rentrée" nom="debut" type="date" requis valeur={etat.valeurs?.debut ?? suggestion.debut} erreurs={etat.champs?.debut} />
      <Champ libelle="Fin" nom="fin" type="date" requis valeur={etat.valeurs?.fin ?? suggestion.fin} erreurs={etat.champs?.fin} />
      <div className="sm:col-span-3">
        <BoutonEnvoi enCours="Préparation…">Préparer la transition</BoutonEnvoi>
      </div>
    </form>
  );
}
