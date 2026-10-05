"use client";

import { useEffect, useId, useRef } from "react";
import { useFormStatus } from "react-dom";

/**
 * Champs et envoi — dossier Study V6, §3.4.
 *
 * Chaque champ a un vrai label, une indication facultative, une erreur reliée
 * par aria-describedby, et garde sa valeur après une erreur (le serveur la
 * renvoie dans `valeurs`). Le bouton d'envoi empêche le double envoi, garde
 * un libellé explicite pendant l'attente, et dit pourquoi il est désactivé.
 */

export interface EtatFormulaire {
  readonly ok?: boolean;
  readonly message?: string | null;
  readonly code?: string | null;
  readonly requestId?: string | null;
  readonly champs?: Readonly<Record<string, readonly string[]>>;
  readonly valeurs?: Readonly<Record<string, string>>;
}

export function Champ({
  libelle,
  nom,
  type = "text",
  aide,
  erreurs,
  valeur,
  requis,
  ...reste
}: {
  libelle: string;
  nom: string;
  type?: string;
  aide?: React.ReactNode;
  erreurs?: readonly string[] | undefined;
  valeur?: string;
  requis?: boolean;
} & Omit<React.InputHTMLAttributes<HTMLInputElement>, "name" | "type" | "defaultValue">) {
  const id = useId();
  const idAide = aide ? `${id}-aide` : undefined;
  const idErreur = erreurs && erreurs.length > 0 ? `${id}-erreur` : undefined;
  return (
    <div className="mb-4">
      <label htmlFor={id} className="mb-1.5 block text-[0.8125rem] font-semibold">
        {libelle}
        {requis ? null : <span className="ml-1 font-normal text-[color:var(--color-encre-faible)]">(facultatif)</span>}
      </label>
      <input
        id={id}
        name={nom}
        type={type}
        defaultValue={valeur}
        required={requis}
        aria-invalid={idErreur ? true : undefined}
        aria-describedby={[idAide, idErreur].filter(Boolean).join(" ") || undefined}
        className="champ"
        {...reste}
      />
      {aide ? (
        <p id={idAide} className="meta m-0 mt-1.5">
          {aide}
        </p>
      ) : null}
      {idErreur ? (
        <p id={idErreur} className="m-0 mt-1.5 text-[0.8125rem] font-medium text-[color:var(--color-erreur)]">
          {erreurs!.join(" ")}
        </p>
      ) : null}
    </div>
  );
}

export function ZoneTexte({
  libelle,
  nom,
  aide,
  erreurs,
  valeur,
  requis,
  lignes = 4,
  ...reste
}: {
  libelle: string;
  nom: string;
  aide?: React.ReactNode;
  erreurs?: readonly string[] | undefined;
  valeur?: string;
  requis?: boolean;
  lignes?: number;
} & Omit<React.TextareaHTMLAttributes<HTMLTextAreaElement>, "name" | "defaultValue">) {
  const id = useId();
  const idAide = aide ? `${id}-aide` : undefined;
  const idErreur = erreurs && erreurs.length > 0 ? `${id}-erreur` : undefined;
  return (
    <div className="mb-4">
      <label htmlFor={id} className="mb-1.5 block text-[0.8125rem] font-semibold">
        {libelle}
        {requis ? null : <span className="ml-1 font-normal text-[color:var(--color-encre-faible)]">(facultatif)</span>}
      </label>
      <textarea
        id={id}
        name={nom}
        rows={lignes}
        defaultValue={valeur}
        required={requis}
        aria-invalid={idErreur ? true : undefined}
        aria-describedby={[idAide, idErreur].filter(Boolean).join(" ") || undefined}
        className="champ min-h-[96px] resize-y"
        {...reste}
      />
      {aide ? (
        <p id={idAide} className="meta m-0 mt-1.5">
          {aide}
        </p>
      ) : null}
      {idErreur ? (
        <p id={idErreur} className="m-0 mt-1.5 text-[0.8125rem] font-medium text-[color:var(--color-erreur)]">
          {erreurs!.join(" ")}
        </p>
      ) : null}
    </div>
  );
}

export function Liste({
  libelle,
  nom,
  options,
  valeur,
  aide,
  erreurs,
  requis = true,
  ...reste
}: {
  libelle: string;
  nom: string;
  options: readonly { valeur: string; libelle: string }[];
  valeur?: string;
  aide?: React.ReactNode;
  erreurs?: readonly string[] | undefined;
  requis?: boolean;
} & Omit<React.SelectHTMLAttributes<HTMLSelectElement>, "name" | "defaultValue">) {
  const id = useId();
  const idAide = aide ? `${id}-aide` : undefined;
  const idErreur = erreurs && erreurs.length > 0 ? `${id}-erreur` : undefined;
  return (
    <div className="mb-4">
      <label htmlFor={id} className="mb-1.5 block text-[0.8125rem] font-semibold">
        {libelle}
      </label>
      <select
        id={id}
        name={nom}
        defaultValue={valeur}
        required={requis}
        aria-invalid={idErreur ? true : undefined}
        aria-describedby={[idAide, idErreur].filter(Boolean).join(" ") || undefined}
        className="champ"
        {...reste}
      >
        {options.map((o) => (
          <option key={o.valeur} value={o.valeur}>
            {o.libelle}
          </option>
        ))}
      </select>
      {aide ? (
        <p id={idAide} className="meta m-0 mt-1.5">
          {aide}
        </p>
      ) : null}
      {idErreur ? (
        <p id={idErreur} className="m-0 mt-1.5 text-[0.8125rem] font-medium text-[color:var(--color-erreur)]">
          {erreurs!.join(" ")}
        </p>
      ) : null}
    </div>
  );
}

/**
 * Bouton d'envoi. Pendant l'attente : désactivé (pas de double envoi),
 * libellé conservé et explicite. Un motif de désactivation s'affiche en clair.
 */
export function BoutonEnvoi({
  children,
  enCours = "Enregistrement…",
  variante = "primaire",
  motifDesactivation,
  className = "",
  ...reste
}: {
  children: React.ReactNode;
  enCours?: string;
  variante?: "primaire" | "secondaire" | "rose" | "danger" | "discret";
  motifDesactivation?: string | null;
  className?: string;
} & Omit<React.ButtonHTMLAttributes<HTMLButtonElement>, "type">) {
  const { pending } = useFormStatus();
  const id = useId();
  const desactive = pending || Boolean(motifDesactivation) || reste.disabled;
  return (
    <span className="inline-flex flex-col gap-1">
      <button
        type="submit"
        {...reste}
        disabled={desactive}
        aria-describedby={motifDesactivation ? `${id}-motif` : undefined}
        aria-busy={pending || undefined}
        className={`bouton bouton-${variante} ${className}`}
      >
        {pending ? enCours : children}
      </button>
      {motifDesactivation ? (
        <span id={`${id}-motif`} className="meta">
          {motifDesactivation}
        </span>
      ) : null}
    </span>
  );
}

/** Message d'état après envoi : succès confirmé par le serveur, ou erreur proche du formulaire. */
export function RetourFormulaire({ etat }: { etat: EtatFormulaire }) {
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (etat.message && etat.ok === false) ref.current?.focus();
  }, [etat]);
  if (!etat.message) return null;
  return (
    <div
      ref={ref}
      tabIndex={-1}
      role={etat.ok ? "status" : "alert"}
      className={`mb-4 rounded-[10px] px-4 py-3 text-[0.8125rem] font-medium outline-none ${
        etat.ok
          ? "bg-[color:var(--color-succes-fond)] text-[color:var(--color-succes)]"
          : "bg-[color:var(--color-erreur-fond)] text-[color:var(--color-erreur)]"
      }`}
    >
      {etat.message}
      {etat.requestId && !etat.ok ? (
        <span className="ml-2 font-normal text-[color:var(--color-encre-faible)]">Réf. {etat.requestId.slice(0, 8)}</span>
      ) : null}
    </div>
  );
}
