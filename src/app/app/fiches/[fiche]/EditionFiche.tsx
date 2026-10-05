"use client";

import Link from "next/link";
import { useActionState } from "react";
import { modifierFiche } from "@/app/app/reviser/actions";
import { BoutonEnvoi, RetourFormulaire, type EtatFormulaire } from "@/components/study/formulaire";
import type { Section } from "@/lib/revision/assemblage";

/** Modifier une fiche crée une nouvelle version ; l'ancienne reste dans l'historique. */
export function EditionFiche({ fiche, version, sections }: { fiche: string; version: number; sections: readonly Section[] }) {
  const [etat, action] = useActionState<EtatFormulaire, FormData>(modifierFiche.bind(null, fiche, version), {});
  return (
    <form action={action} className="grid gap-5">
      <RetourFormulaire etat={etat} />
      {etat.code === "VERSION_CONFLICT" ? (
        <p className="m-0">
          <Link href={`/app/fiches/${fiche}?modifier=1`}>Recharger la dernière version</Link> (copie d&apos;abord tes changements si besoin).
        </p>
      ) : null}
      {sections.map((s, i) => (
        <fieldset key={i} className="panneau">
          <label className="mb-1 block text-[0.8125rem] font-semibold" htmlFor={`section-${i}`}>
            Titre de la section
          </label>
          <input id={`section-${i}`} name="section" defaultValue={s.titre} className="champ mb-3" maxLength={200} />
          {s.extraits.map((e, j) => (
            <div key={j} className="mb-3">
              <label className="sr-only" htmlFor={`extrait-${i}-${j}`}>
                Extrait {j + 1}
              </label>
              <textarea id={`extrait-${i}-${j}`} name="extrait" defaultValue={e.texte} className="champ" rows={3} maxLength={4000} />
              <p className="meta m-0 mt-1">Laisser vide pour retirer cet extrait. La citation d&apos;origine est conservée.</p>
            </div>
          ))}
        </fieldset>
      ))}
      <div className="flex gap-2">
        <BoutonEnvoi enCours="Enregistrement…">Enregistrer une nouvelle version</BoutonEnvoi>
        <Link href={`/app/fiches/${fiche}`} className="bouton bouton-discret">
          Annuler
        </Link>
      </div>
    </form>
  );
}
