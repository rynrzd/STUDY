"use client";

import { useActionState, useMemo } from "react";
import { BoutonEnvoi, Champ, Liste, RetourFormulaire, type EtatFormulaire } from "@/components/study/formulaire";
import { ajouterEvenement } from "./actions";

export function FormulaireEvenement({ cibles }: { cibles: readonly { valeur: string; libelle: string }[] }) {
  const [etat, action] = useActionState<EtatFormulaire, FormData>(ajouterEvenement, {});
  const cle = useMemo(() => (etat.ok ? crypto.randomUUID() : "saisie"), [etat]);
  return (
    <form action={action} key={cle}>
      <RetourFormulaire etat={etat} />
      <Champ libelle="Intitulé" nom="titre" requis maxLength={140} valeur={etat.ok ? "" : etat.valeurs?.titre} erreurs={etat.champs?.titre} placeholder="Réviser le chapitre 2" />
      <div className="grid gap-x-3 sm:grid-cols-2">
        <Champ libelle="Début" nom="debut" type="datetime-local" requis valeur={etat.ok ? "" : etat.valeurs?.debut} erreurs={etat.champs?.debut} />
        <Champ libelle="Fin" nom="fin" type="datetime-local" valeur={etat.ok ? "" : etat.valeurs?.fin} erreurs={etat.champs?.fin} />
      </div>
      {cibles.length > 1 ? (
        <div className="grid gap-x-3 sm:grid-cols-2">
          <Liste libelle="Pour" nom="cible" valeur={etat.valeurs?.cible ?? "moi"} options={cibles} />
          <Liste
            libelle="Type"
            nom="kind"
            valeur={etat.valeurs?.kind ?? "creneau"}
            options={[
              { valeur: "creneau", libelle: "Créneau" },
              { valeur: "revision", libelle: "Révision" },
              { valeur: "controle", libelle: "Contrôle (classe)" },
              { valeur: "cours", libelle: "Cours (classe)" },
              { valeur: "vie_de_classe", libelle: "Vie de classe" },
            ]}
          />
        </div>
      ) : (
        <input type="hidden" name="cible" value="moi" />
      )}
      <BoutonEnvoi variante="secondaire" enCours="Ajout…">
        Ajouter
      </BoutonEnvoi>
    </form>
  );
}
