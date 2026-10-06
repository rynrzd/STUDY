"use client";

import { useActionState } from "react";
import { BoutonEnvoi, Champ, RetourFormulaire, type EtatFormulaire } from "@/components/study/formulaire";
import { basculer, creerClasseCible, preinscrire } from "./actions";

export function FormulaireClasse({ annee }: { annee: string }) {
  const [etat, action] = useActionState<EtatFormulaire, FormData>(creerClasseCible.bind(null, annee), {});
  return (
    <form action={action} noValidate className="flex flex-wrap items-end gap-3">
      <div className="w-full">
        <RetourFormulaire etat={etat} />
      </div>
      <div className="min-w-[220px] flex-1">
        <Champ libelle="Nouvelle classe" nom="libelle" requis valeur={etat.ok ? "" : etat.valeurs?.libelle} erreurs={etat.champs?.libelle} />
      </div>
      <BoutonEnvoi enCours="Création…" variante="secondaire">
        Créer la classe
      </BoutonEnvoi>
    </form>
  );
}

export function FormulairePreinscription({
  source,
  libelle,
  effectif,
  cibles,
}: {
  source: string;
  libelle: string;
  effectif: number;
  cibles: readonly { id: string; label: string }[];
}) {
  const [etat, action] = useActionState<EtatFormulaire, FormData>(preinscrire, {});
  return (
    <form action={action} noValidate className="ligne flex-wrap items-center">
      <input type="hidden" name="source" value={source} />
      <span className="min-w-[160px] flex-1">
        <span className="block font-semibold">{libelle}</span>
        <span className="meta">
          {effectif} élève{effectif > 1 ? "s" : ""} inscrit{effectif > 1 ? "s" : ""}
        </span>
      </span>
      <label className="sr-only" htmlFor={`cible-${source}`}>
        Classe d&apos;arrivée pour {libelle}
      </label>
      <select id={`cible-${source}`} name="cible" className="champ max-w-[220px]" defaultValue="" aria-invalid={etat.champs?.cible ? true : undefined}>
        <option value="" disabled>
          Classe d&apos;arrivée…
        </option>
        {cibles.map((c) => (
          <option key={c.id} value={c.id}>
            {c.label}
          </option>
        ))}
      </select>
      <BoutonEnvoi enCours="Reconduction…" variante="secondaire">
        Reconduire
      </BoutonEnvoi>
      {etat.message ? (
        <p role={etat.ok ? "status" : "alert"} className={`m-0 w-full text-[0.875rem] ${etat.ok ? "text-[color:var(--color-succes)]" : "text-[color:var(--color-erreur)]"}`}>
          {etat.message}
        </p>
      ) : null}
    </form>
  );
}

export function FormulaireBascule({ annee, label, sansClasse }: { annee: string; label: string; sansClasse: number }) {
  const [etat, action] = useActionState<EtatFormulaire, FormData>(basculer.bind(null, annee), {});
  return (
    <form action={action} noValidate className="grid gap-3">
      <RetourFormulaire etat={etat} />
      {sansClasse > 0 ? (
        <label className="flex items-start gap-3 rounded-[12px] bg-[color:var(--color-attention-fond)] p-4 text-[color:var(--color-attention)]">
          <input type="checkbox" name="confirmerSansClasse" value="oui" className="mt-1 size-5 shrink-0" />
          <span>
            Je confirme : {sansClasse} élève{sansClasse > 1 ? "s" : ""} actif{sansClasse > 1 ? "s" : ""} n&apos;
            {sansClasse > 1 ? "auront" : "aura"} plus de classe après la bascule et {sansClasse > 1 ? "seront conduits" : "sera conduit"} à
            l&apos;écran « accès en attente ».
          </span>
        </label>
      ) : null}
      <BoutonEnvoi enCours="Bascule…" className="w-fit">
        Basculer vers {label}
      </BoutonEnvoi>
    </form>
  );
}
