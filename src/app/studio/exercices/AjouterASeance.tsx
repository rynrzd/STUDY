"use client";

import { useActionState } from "react";
import { BoutonEnvoi, RetourFormulaire, type EtatFormulaire } from "@/components/study/formulaire";
import { ajouterASeance } from "./actions";

export function AjouterASeance({ version, seances }: { version: string; seances: readonly { id: string; libelle: string }[] }) {
  const [etat, action] = useActionState<EtatFormulaire, FormData>(ajouterASeance.bind(null, version), {});
  return (
    <form action={action} noValidate className="grid gap-2">
      <RetourFormulaire etat={etat} />
      <label className="etiquette" htmlFor={`lecon-${version}`}>
        Ajouter à la séance
      </label>
      <select id={`lecon-${version}`} name="lecon" className="champ" defaultValue="" aria-invalid={etat.champs?.lecon ? true : undefined}>
        <option value="" disabled>
          Choisir une séance…
        </option>
        {seances.map((s) => (
          <option key={s.id} value={s.id}>
            {s.libelle}
          </option>
        ))}
      </select>
      <BoutonEnvoi enCours="Ajout…">Ajouter au cours</BoutonEnvoi>
      <p className="meta m-0">Une copie non publiée est créée dans la séance : relisez-la, puis publiez-la. L&apos;original reste inchangé.</p>
    </form>
  );
}
