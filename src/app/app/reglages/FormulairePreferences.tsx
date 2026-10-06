"use client";

import { useActionState } from "react";
import { BoutonEnvoi, RetourFormulaire, type EtatFormulaire } from "@/components/study/formulaire";
import { enregistrerPreferences } from "./actions";

export function FormulairePreferences({
  initiales,
  appareilPartage,
}: {
  initiales: { categories: Record<string, boolean>; calme_debut: string; calme_fin: string; copies_locales: boolean };
  appareilPartage: boolean;
}) {
  const [etat, action] = useActionState<EtatFormulaire, FormData>(enregistrerPreferences, {});
  const c = initiales.categories;
  return (
    <form action={action}>
      <RetourFormulaire etat={etat} />
      <fieldset className="mb-5">
        <legend className="mb-2 font-semibold">Me prévenir de…</legend>
        {[
          ["travail", "Devoirs, échéances et corrections"],
          ["classe", "Consultations et vie de classe"],
          ["messages", "Réponses à mes messages et annonces"],
          ["revisions", "Fiches prêtes et révisions prévues"],
        ].map(([cle, libelle]) => (
          <label key={cle} className="flex min-h-[44px] items-center gap-3">
            <input type="checkbox" name={cle} defaultChecked={c[cle!] !== false} /> {libelle}
          </label>
        ))}
      </fieldset>
      <fieldset className="mb-5">
        <legend className="mb-2 font-semibold">Horaires calmes</legend>
        <p className="meta m-0 mb-2">Aucun rappel n&apos;est envoyé pendant ces heures (heure de Paris).</p>
        <div className="flex flex-wrap items-center gap-3">
          <label className="flex items-center gap-2">
            De <input type="time" name="calme_debut" className="champ w-auto" defaultValue={initiales.calme_debut.slice(0, 5)} />
          </label>
          <label className="flex items-center gap-2">
            à <input type="time" name="calme_fin" className="champ w-auto" defaultValue={initiales.calme_fin.slice(0, 5)} />
          </label>
        </div>
      </fieldset>
      <fieldset className="mb-5">
        <legend className="mb-2 font-semibold">Copies hors ligne</legend>
        <label className="flex min-h-[44px] items-center gap-3">
          <input type="checkbox" name="copies_locales" defaultChecked={initiales.copies_locales && !appareilPartage} disabled={appareilPartage} />
          Autoriser le téléchargement de cours et fiches sur cet appareil
        </label>
        {appareilPartage ? <p className="meta m-0">Désactivé : à la connexion, cet appareil a été déclaré comme poste partagé.</p> : null}
      </fieldset>
      <BoutonEnvoi enCours="Enregistrement…">Enregistrer</BoutonEnvoi>
    </form>
  );
}
