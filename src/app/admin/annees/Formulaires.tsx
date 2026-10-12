"use client";

import { useActionState } from "react";
import { BoutonEnvoi, Champ, RetourFormulaire, type EtatFormulaire } from "@/components/study/formulaire";
import { basculer, creerClasseCible, preinscrire, reconduireGroupes } from "./actions";

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
        <label className="flex items-start gap-3 rounded-[var(--rayon-m)] bg-[color:var(--color-attention-fond)] p-4 text-[color:var(--color-attention)]">
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

export function FormulaireReconduireGroupes({
  annee,
  groupes,
}: {
  annee: string;
  groupes: readonly { groupe: string; label: string; kind: string; effectif: number; cours: number; deja_reconduit: boolean }[];
}) {
  const [etat, action] = useActionState<EtatFormulaire, FormData>(reconduireGroupes.bind(null, annee), {});
  const aFaire = groupes.filter((g) => !g.deja_reconduit);
  return (
    <form action={action} noValidate>
      <ul className="m-0 list-none space-y-2 p-0">
        {groupes.map((g) => (
          <li key={g.groupe}>
            <label className="ligne items-center gap-3">
              <input
                type="checkbox"
                name="groupe"
                value={g.groupe}
                defaultChecked={!g.deja_reconduit}
                disabled={g.deja_reconduit}
                className="size-4 shrink-0 accent-[color:var(--color-accent)]"
              />
              <span className="min-w-0 flex-1">
                <span className="block font-semibold">{g.label}</span>
                <span className="meta">
                  {g.kind === "interclasses" ? "Interclasses" : "Demi-groupe"} · {g.effectif} élève{g.effectif > 1 ? "s" : ""} cette année · {g.cours} cours
                </span>
              </span>
              {g.deja_reconduit ? <span className="etiquette-etat" data-ton="succes">Déjà reconduit</span> : null}
            </label>
          </li>
        ))}
      </ul>
      <label className="mt-3 flex items-start gap-3 text-[0.9375rem]">
        <input type="checkbox" name="avec_cours" value="oui" defaultChecked className="mt-1 size-4 shrink-0 accent-[color:var(--color-accent)]" />
        <span>
          Reconduire aussi leurs cours et leurs professeurs
          <span className="aide-champ">Titulaires et co-intervenants, à partir de la rentrée. Les remplaçants ne sont pas reconduits ; aucun élève ne l&apos;est jamais.</span>
        </span>
      </label>
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <BoutonEnvoi enCours="Reconduction…" variante="secondaire">
          {aFaire.length === 0 ? "Reconduire" : `Reconduire ${aFaire.length} groupe${aFaire.length > 1 ? "s" : ""}`}
        </BoutonEnvoi>
        {etat.message ? (
          <p role={etat.ok ? "status" : "alert"} className={`m-0 text-[0.875rem] ${etat.ok ? "text-[color:var(--color-succes)]" : "text-[color:var(--color-erreur)]"}`}>
            {etat.message}
          </p>
        ) : null}
      </div>
    </form>
  );
}
