"use client";

import { useActionState, useMemo } from "react";
import { BoutonEnvoi, Champ, Liste, RetourFormulaire, ZoneTexte, type EtatFormulaire } from "@/components/study/formulaire";
import { ajouterPiste, modifierPiste } from "./actions";

const STATUTS = [
  { valeur: "a_explorer", libelle: "À explorer" },
  { valeur: "a_contacter", libelle: "À contacter" },
  { valeur: "contacte", libelle: "Contacté" },
  { valeur: "reponse", libelle: "Réponse reçue" },
  { valeur: "clos", libelle: "Clos" },
];

export function FormulairePiste() {
  const [etat, action] = useActionState<EtatFormulaire, FormData>(ajouterPiste, {});
  const cle = useMemo(() => (etat.ok ? crypto.randomUUID() : "saisie"), [etat]);
  return (
    <form action={action} key={cle}>
      <RetourFormulaire etat={etat} />
      <Liste
        libelle="Type"
        nom="kind"
        valeur={etat.valeurs?.kind ?? "piste"}
        options={[
          { valeur: "intention", libelle: "Une intention (ce que j'aimerais)" },
          { valeur: "piste", libelle: "Une piste (formation, métier)" },
          { valeur: "stage", libelle: "Un stage" },
        ]}
      />
      <Champ libelle="Intitulé" nom="intitule" requis maxLength={160} valeur={etat.ok ? "" : etat.valeurs?.intitule} erreurs={etat.champs?.intitule} />
      <Champ libelle="Organisation" nom="organisation" maxLength={160} valeur={etat.ok ? "" : etat.valeurs?.organisation} />
      <Champ libelle="Échéance" nom="echeance" type="date" valeur={etat.ok ? "" : etat.valeurs?.echeance} />
      <BoutonEnvoi variante="secondaire" enCours="Ajout…">
        Ajouter
      </BoutonEnvoi>
    </form>
  );
}

export function FormulaireModifierPiste({
  piste,
  version,
  valeurs,
}: {
  piste: string;
  version: number;
  valeurs: { intitule: string; organisation: string; statut: string; contact: string; echeance: string; notes: string };
}) {
  const [etat, action] = useActionState<EtatFormulaire, FormData>(
    (p: EtatFormulaire, d: FormData) => modifierPiste(piste, Number(p.valeurs?.version ?? version), p, d),
    { valeurs: { ...valeurs, version: String(version) } },
  );
  const v = etat.valeurs ?? {};
  return (
    <form action={action}>
      <RetourFormulaire etat={etat} />
      <div className="grid gap-x-3 sm:grid-cols-2">
        <Champ libelle="Intitulé" nom="intitule" requis maxLength={160} valeur={v.intitule} erreurs={etat.champs?.intitule} />
        <Champ libelle="Organisation" nom="organisation" maxLength={160} valeur={v.organisation} />
        <Liste libelle="Statut" nom="statut" valeur={v.statut} options={STATUTS} />
        <Champ libelle="Échéance" nom="echeance" type="date" valeur={v.echeance} />
      </div>
      <Champ libelle="Contact professionnel" nom="contact" maxLength={200} valeur={v.contact} aide="Une adresse ou un service d'entreprise, jamais celle d'un camarade." />
      <ZoneTexte libelle="Notes privées" nom="notes" lignes={3} maxLength={8000} valeur={v.notes} />
      <BoutonEnvoi variante="secondaire" enCours="Enregistrement…">
        Enregistrer
      </BoutonEnvoi>
    </form>
  );
}
